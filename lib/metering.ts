import {db,config,uid,authorize} from './server';
import {AppError,parseSSE} from './core.mjs';
import {reserve,settleHold,type BillingIdentity} from './billing';
import {usageUnits} from './billing-core.mjs';
export type RunBudget={who:BillingIdentity;holdId:string;limit:number;runId:string;rate:any};
export function modelRate(){
 let rate:any;try{rate=JSON.parse(config().ANTHROPIC_RATE_JSON||'{}');}catch{throw new AppError('Tarif du modèle invalide.',503);}
 const fields=['input','output','cacheWrite','cacheRead','usdXaf','overheadXaf'];
 const age=Date.now()-Date.parse(rate.verifiedAt);
 if(!fields.every(k=>Number.isFinite(rate[k])&&rate[k]>=0)||rate.usdXaf<=0||!Number.isFinite(age)||age<0||age>86400000||rate.model!==(config().ANTHROPIC_MODEL||'claude-opus-5-5'))throw new AppError('Le tarif du modèle et le taux de change doivent être vérifiés avant utilisation.',503,'rate_unverified');
 return rate;
}
export async function startRunBudget(who:BillingIdentity,runId:string,credits:number):Promise<RunBudget>{
 const rate=modelRate();const hold=await reserve(who,'chat:'+runId,Math.round(credits*100));return {who,holdId:hold.id,limit:hold.units,runId,rate};
}
export async function finishRunBudget(b:RunBudget){
 const run=await db().prepare('SELECT status,conversation_id,created_at FROM runs WHERE id=?').bind(b.runId).first<any>();
 const delivered=run&&await db().prepare("SELECT 1 delivered FROM messages m,json_each(m.content) block WHERE m.conversation_id=? AND m.role='assistant' AND m.created_at>=? AND json_extract(block.value,'$.type')='text' AND length(trim(COALESCE(json_extract(block.value,'$.text'),'')))>0 UNION ALL SELECT 1 FROM events WHERE run_id=? AND type='tool_result' AND json_extract(data,'$.result.id') IS NOT NULL AND json_extract(data,'$.result.kind') IS NOT NULL LIMIT 1").bind(run.conversation_id,run.created_at,b.runId).first();
 if(run?.status==='failed'&&!delivered){await settleHold(b.holdId,0);return;}
 const rows=await db().prepare('SELECT usage,status FROM provider_usage WHERE run_id=? AND hold_id=?').bind(b.runId,b.holdId).all<any>();
 if(run?.status!=='failed'&&rows.results.some(r=>r.status==='pending'||r.status==='unknown')){await db().prepare("UPDATE credit_holds SET status='needs_reconciliation' WHERE id=? AND status='reserved'").bind(b.holdId).run();return;}
 let units=0;for(const row of rows.results)if(row.status==='complete')units+=usageUnits(JSON.parse(row.usage),b.rate).units;
 await settleHold(b.holdId,units);
}
export async function meteredModel(b:RunBudget,role:string,url:string,init:RequestInit){
 await authorize(b.who.tenant,b.who.user.userId,'write');
 const body=JSON.parse(String(init.body)),countBody={model:body.model,messages:body.messages,system:body.system,tools:body.tools};
 const counter=await fetch('https://api.anthropic.com/v1/messages/count_tokens',{method:'POST',headers:init.headers,body:JSON.stringify(countBody),signal:init.signal});
 if(!counter.ok)throw new AppError('Impossible de vérifier le budget de contexte.',503);
 const count:any=await counter.json();if(!Number.isSafeInteger(count.input_tokens)||count.input_tokens<0)throw new AppError('Estimation du contexte indisponible.',503);
 const used=await db().prepare('SELECT usage,status FROM provider_usage WHERE hold_id=?').bind(b.holdId).all<any>();
 if(used.results.some(x=>['pending','unknown'].includes(x.status)))throw new AppError('Un coût fournisseur reste à rapprocher.',409);
 const consumed=used.results.reduce((n,r)=>n+(r.status==='complete'?usageUnits(JSON.parse(r.usage),b.rate).units:0),0);
 const ceiling=Math.ceil(((Math.ceil(count.input_tokens*1.2)*Math.max(b.rate.input,b.rate.cacheWrite)+body.max_tokens*b.rate.output)/1e6*b.rate.usdXaf+b.rate.overheadXaf)/4*100);
 if(consumed+ceiling>b.limit)throw new AppError('Cette étape dépasse l’enveloppe acceptée. Le travail déjà réalisé est conservé ; augmentez le plafond pour continuer.',402,'budget_exhausted');
 const id=uid();await db().prepare('INSERT INTO provider_usage(id,organization_id,workspace_id,run_id,hold_id,provider,role,rate,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,b.who.organization,b.who.tenant,b.runId,b.holdId,'anthropic',role,JSON.stringify(b.rate),Date.now()).run();
 let response:Response;try{response=await fetch(url,init);}catch(error){await db().prepare("UPDATE provider_usage SET status='unknown' WHERE id=?").bind(id).run();throw error;}
 if(!response.ok||!response.body){await db().prepare("UPDATE provider_usage SET status=? WHERE id=?").bind(response.status>=500?'unknown':'rejected',id).run();return response;}
 await db().prepare('UPDATE provider_usage SET request_id=? WHERE id=?').bind(response.headers.get('request-id'),id).run();
 const iterator=parseSSE(response.body)[Symbol.asyncIterator](),encoder=new TextEncoder();let usage:any={},complete=false,finished=false;
 const save=async()=>{if(finished)return;finished=true;let cost:number|null=null;try{if(complete)cost=usageUnits(usage,b.rate).xaf;}catch{complete=false;}
  await db().prepare('UPDATE provider_usage SET usage=?,cost_xaf=?,status=? WHERE id=?').bind(JSON.stringify(usage),cost,complete?'complete':'unknown',id).run();};
 const stream=new ReadableStream({async pull(controller){try{
  const item=await iterator.next();if(item.done){await save();controller.close();return;}
  const event:any=item.value.data;
  if(event.type==='message_start')usage={...event.message?.usage};
  if(event.type==='message_delta'&&event.usage)usage={...usage,...event.usage};
  if(event.type==='message_stop'){complete=true;await save();}
  controller.enqueue(encoder.encode('event: '+(item.value.event||event.type)+'\ndata: '+JSON.stringify(event)+'\n\n'));
 }catch(error){await save();controller.error(error);}},async cancel(){await save();await iterator.return?.();}});
 return new Response(stream,{status:response.status,headers:response.headers});
}
