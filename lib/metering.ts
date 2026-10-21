import {db,config,uid,authorize} from './server';
import {AppError,parseSSE} from './core.mjs';
import {reserve,settleHold,type BillingIdentity} from './billing';
import {usageUnits} from './billing-core.mjs';
import {modelConnection,modelRequest,estimateInputTokens,requestCostUnits,generationCost} from './llm';
import {modelRateSchema,modelRecordSchema,modelEventSchema,type ModelRate,type ModelCostRow,type ModelUsage} from './model-protocol';
export type {ModelRate} from './model-protocol';
export type RunBudget={who:BillingIdentity;holdId:string;limit:number;runId:string;rate:ModelRate;beforeTool?:()=>Promise<void>};
export type RunSettlementBudget=Pick<RunBudget,'runId'|'holdId'>&{rate?:ModelRate};
type ReconciliationUsage=ModelCostRow&{id:string;rate:string;request_id:string;run_id:string;hold_id:string};
export function modelRate(){
 const connection=modelConnection();let raw:unknown;try{raw=JSON.parse(config()[connection.rateKey]||'{}');}catch{throw new AppError('Tarif du modèle invalide.',503);}
 const parsed=modelRateSchema.safeParse(raw);if(!parsed.success)throw new AppError('Le tarif du modèle et le taux de change doivent être vérifiés avant utilisation.',503,'rate_unverified');const rate=parsed.data;
 const age=Date.now()-Date.parse(rate.verifiedAt);
 if(!Number.isFinite(age)||age<0||age>86400000||rate.model!==connection.model||(connection.provider==='openrouter'&&(typeof rate.fundingFeeBps!=='number'||!Number.isFinite(rate.fundingFeeBps)||rate.fundingFeeBps<0||rate.fundingFeeBps>10000)))throw new AppError('Le tarif du modèle et le taux de change doivent être vérifiés avant utilisation.',503,'rate_unverified');
 return {...rate,provider:connection.provider};
}
export function modelReadiness(){
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
 const browser=await (await import('./browser')).browserUsageUnits(b.holdId);
 if(browser.active)return;
 const run=await db().prepare('SELECT status,conversation_id,created_at FROM runs WHERE id=?').bind(b.runId).first<{status:string;conversation_id:string;created_at:number}>();
 const rows=await db().prepare('SELECT usage,status,provider,cost_xaf FROM provider_usage WHERE run_id=? AND hold_id=?').bind(b.runId,b.holdId).all<ModelCostRow>();
 const delivered=run&&await db().prepare("SELECT 1 delivered FROM messages m,json_each(m.content) block WHERE m.conversation_id=? AND m.role='assistant' AND m.created_at>=? AND json_extract(block.value,'$.type')='text' AND length(trim(COALESCE(json_extract(block.value,'$.text'),'')))>0 UNION ALL SELECT 1 FROM events WHERE run_id=? AND type='tool_result' AND json_extract(data,'$.result.id') IS NOT NULL AND json_extract(data,'$.result.kind') IS NOT NULL UNION ALL SELECT 1 FROM events WHERE run_id=? AND type='text_delta' AND length(trim(COALESCE(json_extract(data,'$.text'),'')))>0 LIMIT 1").bind(run.conversation_id,run.created_at,b.runId,b.runId).first();
 const unresolved=browser.unresolved||rows.results.some(r=>['pending','unknown','estimated'].includes(r.status));
 if(run?.status==='failed'&&!delivered&&!unresolved&&browser.units===0){await settleHold(b.holdId,0);return;}
 if(unresolved){await db().prepare("UPDATE credit_holds SET status='needs_reconciliation' WHERE id=? AND status='reserved'").bind(b.holdId).run();return;}
 let units=browser.units;for(const row of rows.results)if(row.status==='complete'){if(!b.rate)throw new AppError('Le tarif enregistré est nécessaire au rapprochement.',409,'rate_missing');units+=requestCostUnits(row,b.rate,usageUnits);}
 await settleHold(b.holdId,units);
}
export async function meteredMessage(b:RunBudget,role:string,body:Record<string,unknown>,signal:AbortSignal){const request=modelRequest(body,signal);return meteredModel(b,role,request.url,request.init);}
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
export async function meteredModel(b:RunBudget,role:string,url:string,init:RequestInit){
 await authorize(b.who.tenant,b.who.user.userId,'write');
 const connection=modelConnection(),body=modelRecordSchema.parse(JSON.parse(String(init.body))),countBody={model:body.model,messages:body.messages,system:body.system,tools:body.tools};
 if(url!==connection.url||body.model!==connection.model||b.rate.provider&&b.rate.provider!==connection.provider)throw new AppError('Le fournisseur ou le modèle a changé. Relancez la demande.',409);
 let inputTokens:number;
 if(connection.provider==='openrouter')inputTokens=estimateInputTokens(body);
 else{
  const counter=await fetch('https://api.anthropic.com/v1/messages/count_tokens',{method:'POST',headers:init.headers,body:JSON.stringify(countBody),signal:init.signal});
  if(!counter.ok)throw new AppError('Impossible de vérifier le budget de contexte.',503);
  const count=modelRecordSchema.parse(await counter.json());if(typeof count.input_tokens!=='number'||!Number.isSafeInteger(count.input_tokens)||count.input_tokens<0)throw new AppError('Estimation du contexte indisponible.',503);inputTokens=count.input_tokens;
 }
 const used=await db().prepare('SELECT usage,status,provider,cost_xaf FROM provider_usage WHERE hold_id=?').bind(b.holdId).all<ModelCostRow>();
 const browser=await (await import('./browser')).browserUsageUnits(b.holdId);
 if(browser.unresolved)throw new AppError('Un coût navigateur reste à rapprocher.',409,'browser_usage_unknown');
 if(used.results.some(x=>['pending','unknown'].includes(x.status)))throw new AppError('Un coût fournisseur reste à rapprocher.',409);
 const consumed=used.results.reduce((n,r)=>n+(['complete','estimated'].includes(r.status)?requestCostUnits(r,b.rate,usageUnits):0),0);
 const funding=connection.provider==='openrouter'?1+Number(b.rate.fundingFeeBps)/10000:1;
 const requestedOutputTokens=typeof body.max_tokens==='number'&&Number.isSafeInteger(body.max_tokens)&&body.max_tokens>0?body.max_tokens:4096;
 const ceilingFor=(tokens:number)=>Math.ceil(((Math.ceil(inputTokens*1.2)*Math.max(b.rate.input,b.rate.cacheWrite,b.rate.cacheWriteHour||0)+tokens*b.rate.output)/1e6*b.rate.usdXaf*funding+b.rate.overheadXaf)/4*100);
 const available=b.limit-consumed-browser.units-browser.reservedUnits;
 if(ceilingFor(1)>available)throw new AppError('Le plafond accepté ne couvre pas le contexte de cette demande. Réduisez le contexte ou augmentez le plafond avant de continuer.',402,'budget_exhausted');
 let low=1,high=requestedOutputTokens;
 while(low<high){const mid=Math.ceil((low+high)/2);if(ceilingFor(mid)<=available)low=mid;else high=mid-1;}
 if(low<Math.min(128,requestedOutputTokens))throw new AppError('Le plafond accepté est trop bas pour produire une réponse utile. Augmentez-le avant de continuer.',402,'budget_exhausted');
 body.max_tokens=low;
 init={...init,body:JSON.stringify(body)};
 const id=uid();await db().prepare('INSERT INTO provider_usage(id,organization_id,workspace_id,run_id,hold_id,provider,role,rate,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,b.who.organization,b.who.tenant,b.runId,b.holdId,connection.provider,role,JSON.stringify({...b.rate,inputEstimate:inputTokens,inputMethod:connection.provider==='openrouter'?'conservative_estimate':'anthropic_count_tokens'}),Date.now()).run();
 let response:Response;try{response=await fetch(url,init);}catch(error){await db().prepare("UPDATE provider_usage SET status='unknown' WHERE id=?").bind(id).run();throw error;}
 if(!response.ok||!response.body){await db().prepare("UPDATE provider_usage SET status=? WHERE id=?").bind(response.status>=500?'unknown':'rejected',id).run();return response;}
 const generationId=response.headers.get('x-generation-id');
 await db().prepare('UPDATE provider_usage SET request_id=? WHERE id=?').bind(connection.provider==='openrouter'?generationId:response.headers.get('request-id'),id).run();
 const iterator=parseSSE(response.body)[Symbol.asyncIterator](),encoder=new TextEncoder();let usage:ModelUsage={},complete=false,finished=false;
 const save=async()=>{if(finished)return;finished=true;let cost:number|null=null,estimated=false;const streamComplete=complete;
 if(connection.provider==='openrouter'){
  try{const actual=await generationCost(generationId||'',b.rate);cost=actual.xaf;usage={...usage,openrouter_cost_usd:actual.usd,routed_provider:actual.provider,stream_complete:streamComplete,cost_source:'generation'};complete=true;}catch{complete=false;if(streamComplete)try{usageUnits(usage,b.rate);estimated=true;usage={...usage,stream_complete:true,cost_source:'rate_estimate'};}catch{}}
 }else try{if(complete)cost=usageUnits(usage,b.rate).xaf;}catch{complete=false;}
  await db().prepare('UPDATE provider_usage SET usage=?,cost_xaf=?,status=? WHERE id=?').bind(JSON.stringify(usage),cost,complete?'complete':estimated?'estimated':'unknown',id).run();};
 const stream=new ReadableStream({async pull(controller){try{
  const item=await iterator.next();if(item.done){await save();controller.close();return;}
  const event=modelEventSchema.parse(item.value.data);
  if(event.type==='message_start'){const message=event.message===undefined?{}:modelRecordSchema.parse(event.message);usage={...(message.usage===undefined?{}:modelRecordSchema.parse(message.usage))};}
  if(event.type==='message_delta'&&event.usage)usage={...usage,...modelRecordSchema.parse(event.usage)};
  if(event.type==='message_stop'){complete=true;await save();}
  controller.enqueue(encoder.encode('event: '+(item.value.event||event.type)+'\ndata: '+JSON.stringify(event)+'\n\n'));
 }catch(error){await save();controller.error(error);}},async cancel(){await save();await iterator.return?.();}});
 return new Response(stream,{status:response.status,headers:response.headers});
}
