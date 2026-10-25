import {db,config,uid,authorize} from './server';
import {AppError,parseSSE} from './core.mjs';
import {reserve,settleHold,type BillingIdentity} from './billing';
import {usageUnits} from './billing-core.mjs';
import {modelConnection,modelRequest,estimateInputTokens,requestCostUnits,generationCost} from './llm';
import {modelRateSchema,modelRecordSchema,modelEventSchema,type ModelRate,type ModelCostRow,type ModelUsage} from './model-protocol';
import {routingEnabled,routedModel,type RoutingRequest,type RoutedModel} from './model-router';
import {routedRequest,normalizedResponses,anthropicBody} from './model-client';
import {toolUsage} from './tool-usage';
export type {ModelRate} from './model-protocol';
export type RunBudget={who:BillingIdentity;holdId:string;limit:number;runId:string;rate:ModelRate;workId?:string;workStepId?:string;workContext?:string;beforeTool?:()=>Promise<void>;beforeModel?:()=>Promise<void>};
export type RunSettlementBudget=Pick<RunBudget,'runId'|'holdId'>&{rate?:ModelRate};
type ReconciliationUsage=ModelCostRow&{id:string;rate:string;request_id:string;run_id:string;hold_id:string};
export function modelRate(routing:RoutingRequest={task:'conversation'}){
 if(routingEnabled(config()))return routedModel(config(),routing).rate;
 const connection=modelConnection();let raw:unknown;try{raw=JSON.parse(config()[connection.rateKey]||'{}');}catch{throw new AppError('Tarif du modèle invalide.',503);}
 const parsed=modelRateSchema.safeParse(raw);if(!parsed.success)throw new AppError('Le tarif du modèle et le taux de change doivent être vérifiés avant utilisation.',503,'rate_unverified');const rate=parsed.data;
 const age=Date.now()-Date.parse(rate.verifiedAt);
 if(!Number.isFinite(age)||age<0||age>86400000||rate.model!==connection.model||(connection.provider==='openrouter'&&(typeof rate.fundingFeeBps!=='number'||!Number.isFinite(rate.fundingFeeBps)||rate.fundingFeeBps<0||rate.fundingFeeBps>10000)))throw new AppError('Le tarif du modèle et le taux de change doivent être vérifiés avant utilisation.',503,'rate_unverified');
 return {...rate,provider:connection.provider};
}
export function modelReadiness(){
 if(routingEnabled(config())){try{modelRate();return {ready:true,reason:null};}catch(error){return {ready:false,reason:error instanceof AppError&&error.code==='model_not_configured'?'missing_key':'rate_unverified'};}}
 const connection=modelConnection();
 if(!connection.key)return {ready:false,reason:'missing_key'};
 try{modelRate();return {ready:true,reason:null};}
 catch(error){return {ready:false,reason:error instanceof AppError&&error.code==='rate_unverified'?'rate_unverified':'rate_invalid'};}
}
export async function startRunBudget(who:BillingIdentity,runId:string,credits:number):Promise<RunBudget>{
 await reconcileOpenRouterUsage(who.organization,5);
 const rate=modelRate();const hold=await reserve(who,'chat:'+runId,Math.round(credits*100));return {who,holdId:hold.id,limit:hold.units,runId,rate};
}
export async function finishRunBudget(b:RunSettlementBudget){
 const auxiliary=await toolUsage(b.holdId);
 const browser=await (await import('./browser')).browserUsageUnits(b.holdId);
 if(browser.active)return;
 const run=await db().prepare('SELECT status,conversation_id,created_at FROM runs WHERE id=?').bind(b.runId).first<{status:string;conversation_id:string;created_at:number}>();
 const rows=await db().prepare('SELECT usage,status,provider,cost_xaf,rate FROM provider_usage WHERE run_id=? AND hold_id=?').bind(b.runId,b.holdId).all<ModelCostRow>();
 const delivered=run&&await db().prepare("SELECT 1 delivered FROM messages m,json_each(m.content) block WHERE m.conversation_id=? AND m.role='assistant' AND m.created_at>=? AND json_extract(block.value,'$.type')='text' AND length(trim(COALESCE(json_extract(block.value,'$.text'),'')))>0 UNION ALL SELECT 1 FROM events WHERE run_id=? AND type='tool_result' AND json_extract(data,'$.result.id') IS NOT NULL AND json_extract(data,'$.result.kind') IS NOT NULL UNION ALL SELECT 1 FROM events WHERE run_id=? AND type='text_delta' AND length(trim(COALESCE(json_extract(data,'$.text'),'')))>0 LIMIT 1").bind(run.conversation_id,run.created_at,b.runId,b.runId).first();
 const unresolved=auxiliary.unresolved||browser.unresolved||rows.results.some(r=>['pending','unknown','estimated'].includes(r.status));
 if(run?.status==='failed'&&!delivered&&!unresolved&&browser.units===0&&auxiliary.units===0){await settleHold(b.holdId,0);return;}
 if(unresolved){await db().prepare("UPDATE credit_holds SET status='needs_reconciliation' WHERE id=? AND status='reserved'").bind(b.holdId).run();return;}
 let units=browser.units+auxiliary.units;for(const row of rows.results)if(row.status==='complete'){const rate=row.rate?modelRateSchema.parse(JSON.parse(row.rate)):b.rate;if(!rate)throw new AppError('Le tarif enregistré est nécessaire au rapprochement.',409,'rate_missing');units+=requestCostUnits(row,rate,usageUnits);}
 await settleHold(b.holdId,units);
}
export async function meteredMessage(b:RunBudget,role:string,body:Record<string,unknown>,signal:AbortSignal,routing:RoutingRequest={task:'conversation'}){
 await b.beforeModel?.();
 if(routingEnabled(config())){const selected=routedModel(config(),routing),request=routedRequest(selected,body,signal);return meteredModel(b,role,request.url,request.init,selected,body);}
 const request=modelRequest(body,signal);return meteredModel(b,role,request.url,request.init);
}
export async function reconcileOpenRouterUsage(organization?:string,limit=10){
 const rows=await db().prepare("SELECT * FROM provider_usage WHERE provider='openrouter' AND status IN ('estimated','unknown') AND request_id IS NOT NULL"+(organization?' AND organization_id=?':'')+' ORDER BY created_at LIMIT ?').bind(...(organization?[organization,limit]:[limit])).all<ReconciliationUsage>();
 for(const row of rows.results){try{
  const rate=modelRateSchema.parse(JSON.parse(row.rate)),actual=await generationCost(row.request_id,rate),usage={...modelRecordSchema.parse(JSON.parse(row.usage||'{}')),openrouter_cost_usd:actual.usd,routed_provider:actual.provider,cost_source:'generation'};
  await db().prepare("UPDATE provider_usage SET cost_xaf=?,usage=?,status='complete' WHERE id=? AND status IN ('estimated','unknown')").bind(actual.xaf,JSON.stringify(usage),row.id).run();
  const run=await db().prepare('SELECT status FROM runs WHERE id=?').bind(row.run_id).first<{status:string}>();
  if(run&&run.status!=='streaming')await finishRunBudget({runId:row.run_id,holdId:row.hold_id,rate});
 }catch{/* The real cost stays unresolved; never resubmit a generation. */}}
 return {checked:rows.results.length};
}
export async function meteredModel(b:RunBudget,role:string,url:string,init:RequestInit,selected?:RoutedModel,originalBody?:Record<string,unknown>){
 const auxiliary=await toolUsage(b.holdId);
 if(auxiliary.unresolved)throw new AppError('Un coût d’outil attend un rapprochement.',409,'tool_usage_unknown');
 await authorize(b.who.tenant,b.who.user.userId,'write');
 const connection=selected||modelConnection(),rate=selected?.rate||b.rate,body=selected?(selected.provider==='anthropic'?anthropicBody(originalBody||{},selected):{...originalBody,model:selected.model,stream:true}):modelRecordSchema.parse(JSON.parse(String(init.body))),countBody={model:body.model,messages:body.messages,system:body.system,tools:body.tools};
 if(url!==connection.url||body.model!==connection.model||!selected&&rate.provider&&rate.provider!==connection.provider)throw new AppError('Le fournisseur ou le modèle a changé. Relancez la demande.',409);
 let inputTokens:number;
 if(connection.provider==='openrouter'||connection.provider==='openai')inputTokens=estimateInputTokens(body);
 else{
  const counter=await fetch('https://api.anthropic.com/v1/messages/count_tokens',{method:'POST',headers:init.headers,body:JSON.stringify(countBody),signal:init.signal});
  if(!counter.ok)throw new AppError('Impossible de vérifier le budget de contexte.',503);
  const count=modelRecordSchema.parse(await counter.json());if(typeof count.input_tokens!=='number'||!Number.isSafeInteger(count.input_tokens)||count.input_tokens<0)throw new AppError('Estimation du contexte indisponible.',503);inputTokens=count.input_tokens;
 }
 if(selected&&Math.ceil(inputTokens*1.2)>selected.maxInputTokens)throw new AppError('Le contexte dépasse le plafond vérifié du modèle. Réduisez le contexte avant de continuer.',402,'model_context_limit');
 const used=await db().prepare('SELECT usage,status,provider,cost_xaf,rate FROM provider_usage WHERE hold_id=?').bind(b.holdId).all<ModelCostRow>();
 if(selected?.routing.escalation&&used.results.some(row=>row.rate&&modelRecordSchema.parse(JSON.parse(row.rate)).escalation))throw new AppError('La montée en gamme a déjà été utilisée pour ce budget.',409,'model_escalation_limit');
 const browser=await (await import('./browser')).browserUsageUnits(b.holdId);
 if(browser.unresolved)throw new AppError('Un coût navigateur reste à rapprocher.',409,'browser_usage_unknown');
 if(used.results.some(x=>['pending','unknown'].includes(x.status)))throw new AppError('Un coût fournisseur reste à rapprocher.',409);
 const consumed=used.results.reduce((n,r)=>n+(['complete','estimated'].includes(r.status)?requestCostUnits(r,r.rate?modelRateSchema.parse(JSON.parse(r.rate)):b.rate,usageUnits):0),0);
 const funding=connection.provider==='openrouter'?1+Number(rate.fundingFeeBps)/10000:1;
 const requestedOutputTokens=Math.min(typeof body.max_tokens==='number'&&Number.isSafeInteger(body.max_tokens)&&body.max_tokens>0?body.max_tokens:4096,selected?.maxOutputTokens||32768);
 const ceilingFor=(tokens:number)=>Math.ceil(((Math.ceil(inputTokens*1.2)*Math.max(rate.input,rate.cacheWrite,rate.cacheWriteHour||0)+tokens*rate.output)/1e6*rate.usdXaf*funding+rate.overheadXaf)/4*100);
 const available=b.limit-consumed-browser.units-browser.reservedUnits-auxiliary.units;
 if(ceilingFor(1)>available)throw new AppError('Le plafond accepté ne couvre pas le contexte de cette demande. Réduisez le contexte ou augmentez le plafond avant de continuer.',402,'budget_exhausted');
 let low=1,high=requestedOutputTokens;
 while(low<high){const mid=Math.ceil((low+high)/2);if(ceilingFor(mid)<=available)low=mid;else high=mid-1;}
 if(low<Math.min(128,requestedOutputTokens))throw new AppError('Le plafond accepté est trop bas pour produire une réponse utile. Augmentez-le avant de continuer.',402,'budget_exhausted');
 body.max_tokens=low;
 const controller=new AbortController(),signal=init.signal?AbortSignal.any([init.signal,controller.signal,AbortSignal.timeout(120000)]):AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
 init=selected?routedRequest(selected,body,signal).init:{...init,body:JSON.stringify(body),signal};
 const id=uid(),claimed=await db().prepare("INSERT INTO provider_usage(id,organization_id,workspace_id,run_id,hold_id,provider,role,rate,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM provider_usage WHERE hold_id=? AND status IN ('pending','unknown')) AND (SELECT COUNT(*) FROM provider_usage WHERE hold_id=?)=? AND NOT EXISTS(SELECT 1 FROM agent_tool_usage WHERE hold_id=? AND status IN ('pending','unknown'))").bind(id,b.who.organization,b.who.tenant,b.runId,b.holdId,connection.provider,role,JSON.stringify({...rate,inputEstimate:inputTokens,inputMethod:connection.provider==='anthropic'?'anthropic_count_tokens':'conservative_estimate',...(selected?{routingTask:selected.routing.task,escalation:selected.routing.escalation}:{} )}),Date.now(),b.holdId,b.holdId,used.results.length,b.holdId).run();
 if(!claimed.meta.changes)throw new AppError('Le budget est utilisé par un autre appel ou attend un rapprochement.',409,'model_budget_busy');
 let response:Response;try{response=await fetch(url,init);}catch(error){await db().prepare("UPDATE provider_usage SET status='unknown' WHERE id=?").bind(id).run();throw error;}
 if(!response.ok||!response.body){await db().prepare("UPDATE provider_usage SET status=? WHERE id=?").bind(response.status>=500?'unknown':'rejected',id).run();return response;}
 const generationId=response.headers.get('x-generation-id');
 await db().prepare('UPDATE provider_usage SET request_id=? WHERE id=?').bind(connection.provider==='openrouter'?generationId:response.headers.get(connection.provider==='openai'?'x-request-id':'request-id'),id).run();
 const iterator=(selected?.provider==='openai'?normalizedResponses(response.body,selected):parseSSE(response.body))[Symbol.asyncIterator](),encoder=new TextEncoder();let usage:ModelUsage={},complete=false,finished=false;
 const save=async()=>{if(finished)return;finished=true;let cost:number|null=null,estimated=false;const streamComplete=complete;
 if(connection.provider==='openrouter'){
  try{const actual=await generationCost(generationId||'',rate);cost=actual.xaf;usage={...usage,openrouter_cost_usd:actual.usd,routed_provider:actual.provider,stream_complete:streamComplete,cost_source:'generation'};complete=true;}catch{complete=false;if(streamComplete)try{usageUnits(usage,rate);estimated=true;usage={...usage,stream_complete:true,cost_source:'rate_estimate'};}catch{}}
 }else try{if(complete){if(selected&&Number(usage.input_tokens||0)+Number(usage.cache_creation_input_tokens||0)+Number(usage.cache_read_input_tokens||0)>selected.maxInputTokens)throw new AppError('Le contexte dépasse le tarif autorisé.',409,'usage_unknown');cost=usageUnits(usage,rate).xaf;}}catch{complete=false;}
  await db().prepare('UPDATE provider_usage SET usage=?,cost_xaf=?,status=? WHERE id=?').bind(JSON.stringify(usage),cost,complete?'complete':estimated?'estimated':'unknown',id).run();};
 const stream=new ReadableStream({async pull(controller){try{
  const item=await iterator.next();if(item.done){await save();controller.close();return;}
  const event=modelEventSchema.parse(item.value.data);
 if(event.type==='message_start'){const message=event.message===undefined?{}:modelRecordSchema.parse(event.message);if(selected&&message.model!==selected.model)throw new AppError('Le modèle fournisseur ne correspond pas au tarif autorisé.',409,'usage_unknown');usage={...(message.usage===undefined?{}:modelRecordSchema.parse(message.usage))};}
  if(event.type==='message_delta'&&event.usage)usage={...usage,...modelRecordSchema.parse(event.usage)};
  if(event.type==='message_stop'){complete=true;await save();}
  controller.enqueue(encoder.encode('event: '+(item.value.event||event.type)+'\ndata: '+JSON.stringify(event)+'\n\n'));
 }catch(error){await save();controller.error(error);}},async cancel(){controller.abort();await save();await iterator.return?.();}});
 return new Response(stream,{status:response.status,headers:response.headers});
}
