import type {Composio,ToolRouterCreateSessionConfig} from '@composio/core';
import type {AnthropicProvider} from '@composio/anthropic';
import {z} from 'zod';
import {config, db, uid, authorize, createResource, getResource, updateResource} from './server';
import {AppError} from './core.mjs';
import {currentSubscription, reserve, settleHold, type BillingIdentity} from './billing';
import {modelRate} from './metering';
import {instantExplicitlyEnabled} from './execution-policy.mjs';
import {safeComposioUserId,isReadOnlyTool,parseInstantCatalog,instantPlanLimits,parseActualInstantCharge,canonicalJSON} from './composio-policy.mjs';

const toolkitSchema=z.string().regex(/^[a-z][a-z0-9_]{0,99}$/);
const slugSchema=z.string().regex(/^[A-Z][A-Z0-9_]{0,199}$/).refine(s=>!s.startsWith('COMPOSIO_'));
const callSchema=z.object({toolkit:toolkitSchema,toolSlug:slugSchema,arguments:z.record(z.unknown()),mode:z.enum(['connected','instant']).default('connected')}).strict();
type ConnectorCall=z.infer<typeof callSchema>;
type Client=Composio<AnthropicProvider>;
type Session=Awaited<ReturnType<Client['sessions']['use']>>;
type ActionRow={id:string;workspace_id:string;organization_id:string;user_id:string;session_id:string;payload:string;status:string;expires_at:number;max_micros:number;month:string;user_limit:number;org_limit:number;hold_id:string|null};
const query=(sql:string,...values:(string|number|null)[])=>db().prepare(sql).bind(...values);
const SAFE_META=new Set(['COMPOSIO_SEARCH_TOOLS','COMPOSIO_GET_TOOL_SCHEMAS']);
const noStore={'Cache-Control':'private, no-store'};
export {noStore as connectorHeaders};

export function connectorConfigured(){return !!config().COMPOSIO_API_KEY?.trim();}
async function client(){
 if(!connectorConfigured())throw new AppError('Ajoutez COMPOSIO_API_KEY dans la configuration serveur pour connecter vos outils.',503,'composio_not_configured');
 // No CLI credential fallback, telemetry, auto file transfer, or SDK retry of uncertain writes.
 const [{Composio},{AnthropicProvider}]=await Promise.all([import('@composio/core'),import('@composio/anthropic')]);
 return new Composio({apiKey:config().COMPOSIO_API_KEY,provider:new AnthropicProvider(),allowTracking:false,logLevel:'silent'});
}
function providerError(){return new AppError('Composio est indisponible ou la connexion doit être renouvelée. Aucun succès n’a été confirmé.',502,'composio_unavailable');}
async function log(who:BillingIdentity,tool:string,status:string,logId?:string){
 await query('INSERT INTO audit(id,workspace_id,actor,action,target,detail,created_at) VALUES (?,?,?,?,?,?,?)',uid(),who.tenant,who.user.userId,'connector.'+status,tool,JSON.stringify({status,...(logId?{logId}:{})}),Date.now()).run();
}
function authConfigs(){
 try{return z.record(toolkitSchema,z.string().regex(/^ac_[a-zA-Z0-9_-]+$/)).parse(JSON.parse(config().COMPOSIO_AUTH_CONFIGS_JSON||'{}'));}
 catch{throw new AppError('La configuration OAuth des connecteurs est invalide.',503,'composio_config_invalid');}
}
function instantCatalog():{toolkit:string;toolSlug:string;maxCostMicros:number;verifiedAt:string;sourceUrl:string}[]{
 try{return parseInstantCatalog(config().COMPOSIO_INSTANT_CATALOG_JSON||'[]');}
 catch{throw new AppError('Le catalogue de tarifs Instant doit être vérifié.',503,'instant_price_unverified');}
}
async function instantPolicy(who:BillingIdentity){
 const sub=await currentSubscription(who.organization),limits=instantPlanLimits(sub?.plan||'free');
 return {...limits,enabled:instantExplicitlyEnabled(config().COMPOSIO_INSTANT_ENABLED)&&limits.monthlyMicros>0};
}
function checkSession(session:Session,scopeUser:string,mode:'connected'|'instant'){
 const c=session.config;
 if(c.user_id!==scopeUser||c.workbench?.enable!==false||c.proxy_execute?.enable!==false||(mode==='connected'&&c.instant!==false))throw new AppError('La politique de cette session Composio a changé. L’exécution est bloquée.',409,'connector_policy_changed');
 return session;
}
export async function connectorStatus(who:BillingIdentity){
 const policy=await instantPolicy(who);
 return {enabled:policy.enabled,monthlyLimitUsd:policy.organizationMonthlyMicros/1e6,perCallLimitUsd:policy.perCallMicros/1e6,
 note:'Instant : confirmation par appel, crédits Aïra et tarif vérifié requis. Le plafond Business est partagé par l’équipe.'};
}

export async function connectorSession(who:BillingIdentity,conversationId='catalog',mode:'connected'|'instant'='connected'){
 await authorize(who.tenant,who.user.userId,'read');
 const sdk=await client(),scopeUser=await safeComposioUserId(who.tenant,who.user.userId);
 const existing=await query('SELECT session_id FROM connector_sessions WHERE workspace_id=? AND user_id=? AND conversation_id=? AND mode=?',who.tenant,who.user.userId,conversationId,mode).first<{session_id:string}>();
 if(existing){const session=await sdk.sessions.use(existing.session_id);return {sdk,session:checkSession(session,scopeUser,mode),scopeUser};}
 let instant:ToolRouterCreateSessionConfig['instant']=false;
 if(mode==='instant'){
  const policy=await instantPolicy(who),entries=instantCatalog();
  if(!policy.enabled||!entries.length)throw new AppError('Instant attend un forfait actif et un catalogue de tarifs vérifiés. Aucun appel payant n’est autorisé.',409,'instant_unavailable');
  const tools:Record<string,{enable:string[]}>=Object.create(null);
  for(const e of entries){if(!tools[e.toolkit])tools[e.toolkit]={enable:[]};tools[e.toolkit].enable.push(e.toolSlug);}
  instant={toolkits:{enable:Object.keys(tools)},tools,returnInstantCharge:true,returnPricesInSearch:true};
 }
 const options:ToolRouterCreateSessionConfig={instant,sandbox:{enable:false},proxyExecute:false,authConfigs:authConfigs(),manageConnections:false};
 try{
  const created=await sdk.sessions.create(scopeUser,options);
  await query('INSERT OR IGNORE INTO connector_sessions(workspace_id,user_id,conversation_id,session_id,scope_user,mode,created_at) VALUES (?,?,?,?,?,?,?)',who.tenant,who.user.userId,conversationId,created.sessionId,scopeUser,mode,Date.now()).run();
  const winner=await query('SELECT session_id FROM connector_sessions WHERE workspace_id=? AND user_id=? AND conversation_id=? AND mode=?',who.tenant,who.user.userId,conversationId,mode).first<{session_id:string}>();
  return {sdk,session:checkSession(winner?.session_id===created.sessionId?created:await sdk.sessions.use(winner!.session_id),scopeUser,mode),scopeUser};
 }catch{throw providerError();}
}

export async function listConnectorToolkits(who:BillingIdentity,params:URLSearchParams){
 const search=z.string().max(200).parse(params.get('search')||''),cursor=z.string().max(2000).optional().parse(params.get('cursor')||undefined);
 // Only opt into the native connected filter; an omitted value preserves the full catalogue.
 const connected=z.array(z.literal('true')).max(1).parse(params.getAll('connected')).length>0;
 if(!connectorConfigured())return {configured:false,items:[],nextCursor:null,instant:await connectorStatus(who)};
 const {session}=await connectorSession(who);
 try{
  const result=await session.toolkits({search:search||undefined,cursor,limit:30,...(connected?{isConnected:true}:{})});
  return {configured:true,items:result.items.map(t=>({slug:t.slug,name:t.name,logo:t.logo,isNoAuth:t.isNoAuth,connected:!!t.connection?.isActive,status:t.connection?.connectedAccount?.status||(t.isNoAuth?'available':'not_connected'),accountId:t.connection?.connectedAccount?.id})),nextCursor:result.cursor||null,instant:await connectorStatus(who)};
 }catch{throw providerError();}
}
export async function authorizeConnector(who:BillingIdentity,toolkit:string){
 toolkit=toolkitSchema.parse(toolkit);await authorize(who.tenant,who.user.userId,'write');
 const {session}=await connectorSession(who);
 try{
  // Composio owns the authorization flow. Aïra never supplies provider tokens or accepts consent.
  const result=await session.authorize(toolkit);
  const url=new URL(result.redirectUrl!);
  if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)composio\.(dev|ai)$/.test(url.hostname))throw providerError();
  await log(who,'authorize:'+toolkit,'authorization_requested');
  return {redirectUrl:url.href};
 }catch{throw new AppError('Connexion indisponible. Vérifiez dans Composio la configuration OAuth et les permissions de ce connecteur ; Meta Ads nécessite votre propre configuration.',409,'connector_auth_unavailable');}
}
export async function revokeConnector(who:BillingIdentity,accountId:string){
 await authorize(who.tenant,who.user.userId,'write');
 const {sdk,scopeUser}=await connectorSession(who);
 const result=await sdk.connectedAccounts.list({userIds:[scopeUser],limit:100});
 if(!result.items.some(a=>a.id===accountId))throw new AppError('Connexion introuvable pour cet utilisateur.',404);
 try{await sdk.connectedAccounts.revoke(accountId);await log(who,'revoke','revoked');return {revoked:true};}catch{throw providerError();}
}

export const connectorActionTools=[
 {name:'aira_connector_receipt',description:'Read the authoritative status and actual result of this user’s previously proposed connector action after approval. A pending or uncertain receipt never proves success.',input_schema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 {name:'aira_connect_toolkit',description:'Generate the user authorization link for a discovered toolkit. User must click and consent. Never create auth configs or handle tokens.',input_schema:{type:'object',properties:{toolkit:{type:'string'}},required:['toolkit'],additionalProperties:false}},
 {name:'aira_connector_action',description:'Use a discovered app tool with this user’s connected account. Only verified read-only tools run immediately. Every write/unknown operation and every paid Instant call creates an exact-arguments approval card, and does NOT execute. Read its schema first. Instant is only available for administrator-verified priced tools. Never pass credentials or account overrides.',input_schema:{type:'object',properties:{toolkit:{type:'string'},toolSlug:{type:'string'},arguments:{type:'object'},mode:{type:'string',enum:['connected','instant']}},required:['toolkit','toolSlug','arguments'],additionalProperties:false}}
];
export async function connectorAgentTools(who:BillingIdentity,conversationId:string){
 if(!connectorConfigured())return [];
 const {session}=await connectorSession(who,conversationId);
 const tools=z.array(z.object({name:z.string(),description:z.string().optional(),input_schema:z.record(z.unknown())}).passthrough()).parse(await session.tools());
 // Execution and authentication helpers are intentionally replaced by guarded Aïra adapters.
 return [...tools.filter(t=>SAFE_META.has(t.name)),...connectorActionTools];
}
async function metadata(sdk:Client,call:ConnectorCall){
 const tools=await sdk.tools.getRawComposioTools({tools:[call.toolSlug]});
 const tool=tools.find(t=>t.slug===call.toolSlug&&t.toolkit?.slug===call.toolkit);
 if(!tool)throw new AppError('Outil introuvable. Recherchez son schéma avant de continuer.',404,'connector_tool_unknown');
 return tool;
}
async function ownedAccount(sdk:Client,session:Session,who:BillingIdentity,call:ConnectorCall){
 const result=await session.toolkits({toolkits:[call.toolkit],limit:1});
 const toolkit=result.items.find(t=>t.slug===call.toolkit);
 if(!toolkit)throw new AppError('Connecteur introuvable.',404);
 if(toolkit.connection?.isActive&&toolkit.connection.connectedAccount?.status==='ACTIVE'){
  const id=toolkit.connection.connectedAccount.id,scopeUser=await safeComposioUserId(who.tenant,who.user.userId);
  const accounts=await sdk.connectedAccounts.list({userIds:[scopeUser],statuses:['ACTIVE'],toolkitSlugs:[call.toolkit],limit:100});
  if(!accounts.items.some(a=>a.id===id&&a.status==='ACTIVE'&&a.toolkit.slug===call.toolkit))throw new AppError('Ce compte ne fait pas partie de vos connexions actives.',403,'connector_account_denied');
  return id;
 }
 if(toolkit.isNoAuth)return undefined;
 throw new AppError('Connectez ou reconnectez votre compte avant cette action.',409,'connector_not_connected');
}
function nativeApprovalResponses(error:{inputRequests:unknown;requestState?:unknown}){
 if(typeof error.requestState!=='string'||!error.requestState||error.requestState.length>50000)return null;
 const requests=error.inputRequests;
 if(!requests||typeof requests!=='object'||Array.isArray(requests))return null;
 const entries=Object.entries(requests);
 if(!entries.length||entries.length>20)return null;
 const responses:Record<string,{action:'accept';content:{decision:'approve'}}>=Object.create(null);
 for(const [id,value] of entries){
  if(!id||!value||typeof value!=='object'||Array.isArray(value))return null;
  const question=value as Record<string,unknown>,schema=question.requested_schema as Record<string,unknown>|undefined;
  if(question.type!=='elicitation'||question.mode!=='form'||!schema||schema.type!=='object')return null;
  const properties=schema.properties;
  if(!properties||typeof properties!=='object'||Array.isArray(properties)||Object.keys(properties).length!==1||!Object.hasOwn(properties,'decision'))return null;
  if(schema.required!==undefined&&(!Array.isArray(schema.required)||schema.required.some(key=>key!=='decision')))return null;
  const decision=(properties as Record<string,unknown>).decision as Record<string,unknown>|undefined;
  if(!decision||decision.type!=='string')return null;
  const choices=Array.isArray(decision.enum)&&decision.oneOf===undefined?decision.enum:Array.isArray(decision.oneOf)&&decision.enum===undefined?decision.oneOf.map(choice=>choice&&typeof choice==='object'?(choice as Record<string,unknown>).const:undefined):null;
  if(!choices||!choices.includes('approve')||!choices.includes('deny')||choices.some(choice=>typeof choice!=='string'||!['approve','deny','always_approve'].includes(choice)))return null;
  // A local click covers this exact call only; never grant Composio a lasting session approval.
  responses[id]={action:'accept',content:{decision:'approve'}};
 }
 return responses;
}
async function executeConnected(who:BillingIdentity,session:Session,call:ConnectorCall,account?:string,approvalGranted=false){
 try{
  let result;
  try{result=await session.execute(call.toolSlug,call.arguments,account?{account}:undefined);}
  catch(error){
   const {ComposioToolInputRequiredError}=await import('@composio/core');
   if(!(error instanceof ComposioToolInputRequiredError))throw error;
   if(!approvalGranted)throw new AppError('Composio demande une confirmation pour cet appel exact.',409,'connector_approval_required');
   const inputResponses=nativeApprovalResponses(error);
   if(!inputResponses)throw new AppError('Le fournisseur demande une intervention supplémentaire. Aucun appel n’a été exécuté.',409,'connector_input_required');
   await authorize(who.tenant,who.user.userId,'write');
   try{result=await session.execute(call.toolSlug,call.arguments,{...(account?{account}:{}),inputResponses,requestState:error.requestState});}
   catch(resumeError){
    if(resumeError instanceof ComposioToolInputRequiredError)throw new AppError('Le fournisseur demande une intervention supplémentaire. Aucun appel n’a été exécuté.',409,'connector_input_required');
    throw resumeError;
   }
  }
  await log(who,call.toolSlug,result.resultType,result.logId);
  return result;
 }catch(error){
  if(error instanceof AppError&&['connector_approval_required','connector_input_required'].includes(error.code)){await log(who,call.toolSlug,error.code);throw error;}
  await log(who,call.toolSlug,'uncertain');throw providerError();
 }
}
export async function executeConnectorAgentTool(who:BillingIdentity,conversationId:string,name:string,input:unknown){
 await authorize(who.tenant,who.user.userId,'write');
 if(name==='aira_connector_receipt'){
  const {id}=z.object({id:z.string().uuid()}).strict().parse(input);
  const row=await query('SELECT status,result,log_id FROM connector_actions WHERE id=? AND workspace_id=? AND user_id=?',id,who.tenant,who.user.userId).first<{status:string;result:string|null;log_id:string|null}>();
  if(!row)throw new AppError('Action introuvable pour cet utilisateur.',404);
  return {id,status:row.status,result:row.result?JSON.parse(row.result):null,logId:row.log_id};
 }
 if(name==='aira_connect_toolkit')return authorizeConnector(who,z.object({toolkit:toolkitSchema}).strict().parse(input).toolkit);
 const {sdk,session}=await connectorSession(who,conversationId);
 if(SAFE_META.has(name)){
  try{
   // Do not slice, summarize, filter or reconstruct SEARCH: skills must reach the native tool_result intact.
   const result=await session.executeMeta(name as 'COMPOSIO_SEARCH_TOOLS'|'COMPOSIO_GET_TOOL_SCHEMAS',z.record(z.unknown()).parse(input));
   await log(who,name,result.resultType,result.logId);return result;
  }catch{await log(who,name,'failed');throw providerError();}
 }
 if(name!=='aira_connector_action')throw new AppError('Cet outil ne peut pas contourner les validations Aïra.',403,'connector_tool_denied');
 const call=callSchema.parse(input);
 if(canonicalJSON(call.arguments).length>50000)throw new AppError('Les paramètres sont trop volumineux.',400);
 const tool=await metadata(sdk,call);
 if(call.mode==='connected'){
  const account=await ownedAccount(sdk,session,who,call);
  if(isReadOnlyTool(tool)){
   try{return await executeConnected(who,session,call,account);}
   catch(error){if(!(error instanceof AppError)||error.code!=='connector_approval_required')throw error;}
  }
  return proposeAction(who,session,call,account);
 }
 return proposeAction(who,session,call);
}

async function proposeAction(who:BillingIdentity,session:Session,call:ConnectorCall,account?:string){
 let maxMicros=0,maxCredits=0,sessionId=session.sessionId;
 const policy=await instantPolicy(who);
 if(call.mode==='instant'){
  const entry=instantCatalog().find(e=>e.toolkit===call.toolkit&&e.toolSlug===call.toolSlug);
  if(!policy.enabled||!entry||entry.maxCostMicros>policy.perCallMicros)throw new AppError('Cet appel Instant ne dispose pas d’un tarif vérifié compatible avec votre plafond.',409,'instant_price_unverified');
  const paid=await connectorSession(who,'instant','instant');sessionId=paid.session.sessionId;
  // Eligibility comes from the provider, independently of the application price registry.
  const search=await paid.session.search({query:call.toolSlug,toolkits:[call.toolkit]});
  if(!search.toolkitConnectionStatuses.some(t=>t.toolkit===call.toolkit&&t.instantAccount?.allowedToolSlugs.includes(call.toolSlug)))throw new AppError('Cet outil ne prend pas en charge Instant.',409,'instant_unsupported');
  maxMicros=entry.maxCostMicros;
  const rate=modelRate();maxCredits=Math.ceil(((maxMicros/1e6)*rate.usdXaf*1.2+rate.overheadXaf)/4*100);
 }
 const data={...call,accountId:account||null,requester:who.user.userId,sessionId,priceUsd:maxMicros?maxMicros/1e6:null,maxCredits:maxCredits/100,expiresAt:Date.now()+15*60000,status:'pending'};
 const resource=await createResource(who.tenant,'connector_action',call.toolkit+' · '+call.toolSlug,data,'pending');
 await query('INSERT INTO connector_actions(id,workspace_id,organization_id,user_id,session_id,payload,expires_at,created_at,max_micros,month,user_limit,org_limit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',resource.id,who.tenant,who.organization,who.user.userId,sessionId,canonicalJSON(data),data.expiresAt,Date.now(),maxMicros,new Date().toISOString().slice(0,7),policy.monthlyMicros,policy.organizationMonthlyMicros).run();
 await log(who,call.toolSlug,'approval_required');return resource;
}
async function syncAction(who:BillingIdentity,id:string,status:string,result?:unknown){
 const resource=await getResource(who.tenant,id);
 return updateResource(who.tenant,id,resource.version,{status,data:{...resource.data,status,...(result!==undefined?{result}:{})}});
}
export async function decideConnectorAction(who:BillingIdentity,id:string,decision:'approve'|'reject'){
 await authorize(who.tenant,who.user.userId,'write');
 const row=await query('SELECT * FROM connector_actions WHERE id=? AND workspace_id=? AND user_id=? AND organization_id=?',id,who.tenant,who.user.userId,who.organization).first<ActionRow>();
 if(!row)throw new AppError('Approbation introuvable pour cet utilisateur.',404);
 if(row.status!=='pending')return getResource(who.tenant,id);
 const resource=await getResource(who.tenant,id),data=JSON.parse(row.payload);
 if(canonicalJSON(resource.data)!==row.payload)throw new AppError('La proposition a changé. Une nouvelle approbation est nécessaire.',409,'stale_approval');
 if(row.expires_at<=Date.now())throw new AppError('Cette proposition a expiré. Demandez une nouvelle proposition.',409,'approval_expired');
 if(decision==='reject'){
  const rejected=await query("UPDATE connector_actions SET status='rejected' WHERE id=? AND status='pending'",id).run();
  if(!rejected.meta.changes)return getResource(who.tenant,id);
  return syncAction(who,id,'rejected');
 }
 const call=callSchema.parse({toolkit:data.toolkit,toolSlug:data.toolSlug,arguments:data.arguments,mode:data.mode});
 const {sdk,session}=await connectorSession(who,call.mode==='instant'?'instant':'catalog',call.mode);
 await metadata(sdk,call);
 let account:string|undefined;
 if(call.mode==='connected'){
  account=await ownedAccount(sdk,session,who,call);
  if((account||null)!==data.accountId)throw new AppError('Le compte connecté a changé. Demandez une nouvelle proposition.',409,'stale_approval');
 }else{
  const policy=await instantPolicy(who),entry=instantCatalog().find(e=>e.toolkit===call.toolkit&&e.toolSlug===call.toolSlug);
  if(!policy.enabled||!entry||entry.maxCostMicros!==row.max_micros||row.max_micros>policy.perCallMicros||row.user_limit!==policy.monthlyMicros||row.org_limit!==policy.organizationMonthlyMicros||row.month!==new Date().toISOString().slice(0,7))throw new AppError('Le tarif ou le budget Instant a changé. Demandez une nouvelle proposition.',409,'stale_approval');
 }
 // Atomic compare-and-set: only one request may cross the external mutation boundary.
 let claim;
 try{claim=await query("UPDATE connector_actions SET status='executing' WHERE id=? AND status='pending' AND expires_at>?",id,Date.now()).run();}
 catch{throw new AppError('Le budget Instant mensuel est atteint.',409,'instant_budget');}
 if(!claim.meta.changes)return getResource(who.tenant,id);
 let holdId:string|undefined;
 if(call.mode==='instant'){
  try{
   const hold=await reserve(who,'instant:'+id,Math.round(data.maxCredits*100));holdId=hold.id;
   await query('UPDATE connector_actions SET hold_id=? WHERE id=?',hold.id,id).run();
  }catch(error){await query("UPDATE connector_actions SET status='pending' WHERE id=? AND status='executing'",id).run();throw error;}
 }
 try{
  await authorize(who.tenant,who.user.userId,'write');
  await syncAction(who,id,'executing');
  // Reuse the proposal's own session, never a caller-supplied session/account or approval response.
  const original=checkSession(await sdk.sessions.use(row.session_id),await safeComposioUserId(who.tenant,who.user.userId),call.mode);
  const result=await executeConnected(who,original,call,call.mode==='instant'?'instant_account':account,true);
  const actual=call.mode==='instant'?parseActualInstantCharge(result):0;
  const uncertain=call.mode==='instant'&&(actual===null||actual>row.max_micros);
  const status=uncertain?'uncertain':result.resultType==='completed'?'completed':'failed';
  await query('UPDATE connector_actions SET status=?,actual_micros=?,result=?,log_id=? WHERE id=?',status,actual,JSON.stringify(result),result.logId,id).run();
  if(holdId&&actual!==null&&!uncertain){const units=result.resultType==='failed'?0:Math.min(Math.round(data.maxCredits*100),Math.ceil(Math.round(data.maxCredits*100)*actual/row.max_micros));await settleHold(holdId,units);}
  return syncAction(who,id,status,result);
 }catch(error){
  if(error instanceof AppError&&error.code==='connector_input_required'){
   await query("UPDATE connector_actions SET status='needs_input',actual_micros=0 WHERE id=?",id).run();
   if(holdId)await settleHold(holdId,0);
   return syncAction(who,id,'needs_input');
  }
  // Timeouts can hide a successful mutation or charge. Retain the hold; never retry automatically.
  await query("UPDATE connector_actions SET status='uncertain' WHERE id=?",id).run();
  await log(who,call.toolSlug,'uncertain');return syncAction(who,id,'uncertain');
 }
}
