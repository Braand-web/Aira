import {z} from 'zod';
import {db,config,uid,getResource,createResource,authorize} from './server';
import {missionSchema} from './contracts';
import {AppError} from './core.mjs';
import {startRunBudget,finishRunBudget,type RunBudget} from './metering';
import type {BillingIdentity} from './billing';

type DurableMission={id:string;workspace_id:string;organization_id:string;actor_id:string;approved_version:number;mandate:string;status:string;cursor:number;budget_units:number;spent_units:number;reserved_units:number;expires_at:number;next_at:number;lease_token:string|null;lease_until:number};
type DurableStep={id:string;mission_id:string;ordinal:number;status:string;run_id:string;conversation_id:string;reserved_units:number};
export type MissionRunner=(tenant:string,conversationId:string,runId:string,emit:(type:string,data:unknown)=>Promise<void>,signal:AbortSignal,budget:RunBudget)=>Promise<void>;
const q=(sql:string,...args:(string|number|null)[])=>db().prepare(sql).bind(...args);
const mandateSchema=z.object({version:z.number().int().positive(),approved:z.literal(true),expiresAt:z.number().int(),maxCredits:z.number().int().min(1).max(1000),stepCredits:z.number().int().min(1).max(1000)});
const planSchema=missionSchema.extend({maxCredits:z.number().int().min(1).max(1000),mode:z.literal('autonomous')});
async function audit(who:BillingIdentity,action:string,target:string){await q('INSERT INTO audit(id,workspace_id,actor,action,target,detail,created_at) VALUES (?,?,?,?,?,?,?)',uid(),who.tenant,who.user.userId,action,target,'{}',Date.now()).run();}
export function durableReadiness(){return {enabled:config().AUTONOMY_ENABLED==='true'&&config().AUTONOMY_SCHEDULER_VERIFIED==='true'&&!!config().SCHEDULER_SECRET,scope:'analysis_drafts_and_approved_connected_reads',externalWrites:'separate_approval_required'};}
export async function missionState(who:BillingIdentity,id:string){await getResource(who.tenant,id);const mission=await q('SELECT * FROM durable_missions WHERE id=? AND workspace_id=?',id,who.tenant).first<DurableMission>();if(!mission)return null;const steps=await q('SELECT ordinal,status,run_id,conversation_id,result,error,started_at,finished_at FROM durable_steps WHERE mission_id=? ORDER BY ordinal',id).all();return {...mission,mandate:JSON.parse(mission.mandate),lease_token:undefined,steps:steps.results};}
export async function activateMission(who:BillingIdentity,id:string,input:unknown){
 await authorize(who.tenant,who.user.userId,'approve');if(!durableReadiness().enabled)throw new AppError('Le planificateur autonome n’est pas encore validé.',503,'autonomy_not_ready');
 const p=mandateSchema.parse(input),resource=await getResource(who.tenant,id),plan=planSchema.parse(resource.data),now=Date.now();
 if(p.maxCredits!==plan.maxCredits||p.stepCredits*plan.steps.length>p.maxCredits)throw new AppError('Le plafond par étape doit respecter le budget total approuvé.',400);
 if(p.expiresAt<=now||p.expiresAt>now+7*86400000)throw new AppError('Le mandat doit expirer dans les sept jours.',400);
 const mandate=JSON.stringify({...plan,expiresAt:p.expiresAt,stepCredits:p.stepCredits,scope:['analysis','private_drafts','connected_reads'],externalWrites:'approval_required'});
 const existing=await q('SELECT * FROM durable_missions WHERE id=? AND workspace_id=?',id,who.tenant).first<DurableMission>();
 if(existing){if(existing.approved_version===p.version&&existing.actor_id===who.user.userId&&existing.mandate===mandate)return missionState(who,id);throw new AppError('Un autre mandat est déjà enregistré.',409);}
 if(resource.kind!=='mission'||resource.status!=='draft'||resource.version!==p.version)throw new AppError('Ce mandat ne correspond pas au brouillon actuel.',409,'stale_mandate');
 await db().batch([
 q("INSERT OR IGNORE INTO durable_missions(id,workspace_id,organization_id,actor_id,approved_version,mandate,status,budget_units,expires_at,next_at,created_at,updated_at) SELECT ?,?,?,?,?,?,'queued',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM resources WHERE id=? AND workspace_id=? AND version=? AND kind='mission' AND status='draft')",id,who.tenant,who.organization,who.user.userId,p.version,mandate,p.maxCredits*100,p.expiresAt,now,now,now,id,who.tenant,p.version),
 q("UPDATE resources SET status='queued',updated_at=? WHERE id=? AND workspace_id=? AND version=? AND status='draft' AND EXISTS(SELECT 1 FROM durable_missions d WHERE d.id=resources.id)",now,id,who.tenant,p.version)
 ]);
 const saved=await q('SELECT mandate FROM durable_missions WHERE id=? AND workspace_id=?',id,who.tenant).first<{mandate:string}>();if(saved?.mandate!==mandate)throw new AppError('Le mandat a changé.',409);
 await audit(who,'mission.activated',id);return missionState(who,id);
}
export async function controlMission(who:BillingIdentity,id:string,action:'suspend'|'cancel'|'resume'){
 await authorize(who.tenant,who.user.userId,action==='resume'?'approve':'write');const mission=await q('SELECT * FROM durable_missions WHERE id=? AND workspace_id=?',id,who.tenant).first<DurableMission>();if(!mission)throw new AppError('Mission introuvable.',404);
 if(['completed','cancelled'].includes(mission.status))throw new AppError('Cette mission est terminée.',409);
 if(action==='resume'){
  if(!durableReadiness().enabled||mission.expires_at<=Date.now())throw new AppError('Le mandat est expiré ou le planificateur indisponible.',409);
  const uncertain=await q("SELECT id FROM durable_steps WHERE mission_id=? AND status IN ('running','uncertain')",id).first();if(uncertain)throw new AppError('Une étape doit être rapprochée avant reprise. Aucun appel ne sera répété.',409,'mission_needs_reconciliation');
  const steps=await q("SELECT result FROM durable_steps WHERE mission_id=? AND status='completed'",id).all<{result:string}>();
  for(const step of steps.results){const result=JSON.parse(step.result||'{}');for(const proposalId of result.approvalIds||[]){const proposal=await getResource(who.tenant,proposalId);if(['awaiting_approval','pending','executing','needs_input','uncertain'].includes(proposal.status))throw new AppError('Une proposition attend encore votre décision ou son rapprochement.',409,'mission_approval_pending');}}
 }
 const status=action==='resume'?'queued':action==='cancel'?'cancelled':'suspended',now=Date.now();
 await db().batch([q('UPDATE durable_missions SET status=?,next_at=?,updated_at=? WHERE id=?',status,now,now,id),q('UPDATE resources SET status=?,updated_at=? WHERE id=? AND workspace_id=?',status,now,id,who.tenant),q("UPDATE runs SET status='cancelled',updated_at=? WHERE id IN (SELECT run_id FROM durable_steps WHERE mission_id=?) AND status='streaming'",now,id)]);
 await audit(who,'mission.'+action,id);return missionState(who,id);
}
async function missionNotice(m:DurableMission,kind:string){await q('INSERT OR IGNORE INTO billing_notifications(id,organization_id,kind,message,created_at) VALUES (?,?,?,?,?)','mission:'+m.id+':'+m.cursor+':'+kind,m.organization_id,'mission.'+kind,kind==='completed'?'Votre mission est terminée.':kind==='uncertain'?'Une étape de mission doit être rapprochée avant de continuer.':'Votre mission attend votre intervention.',Date.now()).run();}
async function stopMission(m:DurableMission,status:string,error:string){const current=await q('SELECT status FROM durable_missions WHERE id=?',m.id).first<{status:string}>();if(current&&['cancelled','suspended'].includes(current.status))return;const now=Date.now();await db().batch([q('UPDATE durable_missions SET status=?,lease_token=NULL,lease_until=0,updated_at=? WHERE id=?',status,now,m.id),q('UPDATE resources SET status=?,updated_at=? WHERE id=?',status,now,m.id)]);await missionNotice(m,error);}
export async function runDurableTick(runner?:MissionRunner){
 if(!durableReadiness().enabled)throw new AppError('L’autonomie durable est désactivée.',503,'autonomy_not_ready');
 const now=Date.now();let completed=0,waiting=0;
 // An expired lease after an external call is NOT proof of failure. Never replay that step blindly.
 const stale=await q("SELECT * FROM durable_missions WHERE status='running' AND lease_until<=?",now).all<DurableMission>();
 for(const m of stale.results){await q("UPDATE durable_steps SET status='uncertain',error='worker_interrupted' WHERE mission_id=? AND status='running'",m.id).run();await q("UPDATE runs SET status='failed',error='worker_interrupted',updated_at=? WHERE id IN (SELECT run_id FROM durable_steps WHERE mission_id=? AND status='uncertain') AND status='streaming'",now,m.id).run();await stopMission(m,'waiting_user','uncertain');waiting++;}
 const rows=await q("SELECT * FROM durable_missions WHERE status='queued' AND next_at<=? AND lease_until<=? ORDER BY next_at,id LIMIT 3",now,now).all<DurableMission>();
 for(const m of rows.results){
  const token=uid(),lock=await q("UPDATE durable_missions SET status='running',lease_token=?,lease_until=?,updated_at=? WHERE id=? AND status='queued' AND lease_until<=?",token,now+240000,now,m.id,now).run();if(!lock.meta.changes)continue;
  try{
   await authorize(m.workspace_id,m.actor_id,'write');const resource=await getResource(m.workspace_id,m.id),mandate=planSchema.extend({expiresAt:z.number(),stepCredits:z.number().int().positive()}).parse(JSON.parse(m.mandate));
   if(['suspended','cancelled'].includes(resource.status)){await stopMission(m,resource.status,'intervention');continue;}
   if(resource.version!==m.approved_version||m.expires_at<=Date.now()){await stopMission(m,'waiting_user','mandate_expired');waiting++;continue;}
   if(m.cursor>=mandate.steps.length){await stopMission(m,'completed','completed');completed++;continue;}
   const units=mandate.stepCredits*100;if(m.spent_units+m.reserved_units+units>m.budget_units){await stopMission(m,'waiting_user','budget_exhausted');waiting++;continue;}
   const prior=await q('SELECT * FROM durable_steps WHERE mission_id=? AND ordinal=?',m.id,m.cursor).first<DurableStep>();if(prior){await stopMission(m,'waiting_user','uncertain');waiting++;continue;}
   const stepId=m.id+':'+m.cursor,runId='durable:'+stepId;const conversation=m.cursor===0?await createResource(m.workspace_id,'conversation','Mission : '+resource.title,{},'saved'):await getResource(m.workspace_id,(await q('SELECT conversation_id FROM durable_steps WHERE mission_id=? ORDER BY ordinal LIMIT 1',m.id).first<{conversation_id:string}>())!.conversation_id);
   const who:BillingIdentity={tenant:m.workspace_id,organization:m.organization_id,role:(await authorize(m.workspace_id,m.actor_id,'write')).role,user:{userId:m.actor_id,email:'',displayName:''}};
   let budget:RunBudget|undefined;const abort=new AbortController();let needsApproval=false,lastHeartbeat=0,delivered=false;const approvalIds:string[]=[];
   try{
    const existingHold=await q('SELECT status FROM credit_holds WHERE reference=?','chat:'+runId).first<{status:string}>();if(existingHold?.status==='settled')throw new AppError('La réservation de cette étape doit être rapprochée.',409,'mission_needs_reconciliation');
    budget=await startRunBudget(who,runId,mandate.stepCredits);
    await db().batch([q("INSERT INTO durable_steps(id,mission_id,ordinal,status,run_id,conversation_id,reserved_units,started_at) VALUES (?,?,?,'running',?,?,?,?)",stepId,m.id,m.cursor,runId,conversation.id,units,Date.now()),q('UPDATE durable_missions SET reserved_units=? WHERE id=? AND lease_token=?',units,m.id,token),q("INSERT INTO runs(id,workspace_id,conversation_id,status,created_at,updated_at) VALUES (?,?,?,'streaming',?,?)",runId,m.workspace_id,conversation.id,Date.now(),Date.now()),q("UPDATE resources SET status='running',updated_at=? WHERE id=?",Date.now(),m.id),q("INSERT INTO messages(id,workspace_id,conversation_id,role,content,created_at) VALUES (?,?,?,'user',?,?)",uid(),m.workspace_id,conversation.id,JSON.stringify([{type:'text',text:'Mandat autonome approuvé : '+JSON.stringify(mandate)+'\nÉtape '+(m.cursor+1)+' : '+mandate.steps[m.cursor]+'\nExécute seulement cette étape. Les publications, modifications externes et dépenses publicitaires exigent toujours une approbation distincte. Arrête et explique si une condition d’arrêt s’applique.'}]),Date.now())]);
    const emit=async(type:string,data:unknown)=>{
     if(Date.now()-lastHeartbeat>1000||type==='tool_start'){
      const current=await q('SELECT status FROM durable_missions WHERE id=?',m.id).first<{status:string}>(),resource=await getResource(m.workspace_id,m.id);
      if(current?.status!=='running'||['cancelled','suspended'].includes(resource.status)){abort.abort();throw new AppError('Mission suspendue.',499,'cancelled');}
      await authorize(m.workspace_id,m.actor_id,'write');lastHeartbeat=Date.now();await db().batch([q('UPDATE durable_missions SET lease_until=? WHERE id=? AND lease_token=?',Date.now()+240000,m.id,token),q('UPDATE runs SET updated_at=? WHERE id=?',Date.now(),runId)]);
     }
     const result=typeof data==='object'&&data!==null&&'result' in data?(data as {result:Record<string,unknown>}).result:null;if(result&&(result.status==='awaiting_approval'||result.kind==='connector_action'&&result.status==='pending')){needsApproval=true;if(typeof result.id==='string')approvalIds.push(result.id);}
     if(type==='text_delta'&&data&&typeof data==='object'&&'text' in data&&typeof data.text==='string'&&data.text.trim()||result&&typeof result.id==='string'&&typeof result.kind==='string')delivered=true;
     await q('INSERT INTO events(run_id,type,data,created_at) VALUES (?,?,?,?)',runId,type,JSON.stringify(data),Date.now()).run();
    };
    const execute=runner||(await import('./agent')).runAgent;await execute(m.workspace_id,conversation.id,runId,emit,AbortSignal.any([abort.signal,AbortSignal.timeout(180000)]),budget);
    if(!delivered)throw new AppError('Aucun résultat vérifiable n’a été enregistré pour cette étape.',502,'mission_result_missing');
    await q("UPDATE runs SET status='completed',updated_at=? WHERE id=? AND status='streaming'",Date.now(),runId).run();await finishRunBudget(budget);
    const hold=await q('SELECT status,actual FROM credit_holds WHERE id=?',budget.holdId).first<{status:string;actual:number}>();
    if(hold?.status!=='settled'){await q("UPDATE durable_steps SET status='uncertain',error='usage_pending' WHERE id=?",stepId).run();await stopMission(m,'waiting_user','uncertain');waiting++;continue;}
    const finalState=await q('SELECT status FROM durable_missions WHERE id=?',m.id).first<{status:string}>();
    const status=finalState&&['suspended','cancelled'].includes(finalState.status)?finalState.status:needsApproval?'waiting_user':m.cursor+1>=mandate.steps.length?'completed':'queued',at=Date.now();
    await db().batch([q("UPDATE durable_steps SET status='completed',result=?,finished_at=? WHERE id=?",JSON.stringify({runId,awaitingApproval:needsApproval,approvalIds}),at,stepId),q('UPDATE durable_missions SET cursor=cursor+1,spent_units=spent_units+?,reserved_units=0,status=?,next_at=?,lease_token=NULL,lease_until=0,updated_at=? WHERE id=? AND lease_token=?',hold.actual,status,at,at,m.id,token),q('UPDATE resources SET status=?,updated_at=? WHERE id=?',status,at,m.id)]);
    if(status==='completed'){completed++;await missionNotice(m,'completed');}if(needsApproval){waiting++;await missionNotice(m,'approval');}
   }catch(error){
    abort.abort();await q("UPDATE runs SET status='failed',error=?,updated_at=? WHERE id=? AND status='streaming'",error instanceof AppError?error.code:'step_failed',Date.now(),runId).run();
    if(budget)await finishRunBudget(budget).catch(()=>undefined);
    await q("UPDATE durable_steps SET status='uncertain',error=?,finished_at=? WHERE id=?",error instanceof AppError?error.code:'step_failed',Date.now(),stepId).run();
    await stopMission(m,'waiting_user','uncertain');waiting++;
   }
  }catch(error){await stopMission(m,'waiting_user',error instanceof AppError?error.code:'intervention');waiting++;}
 }
 return {checked:rows.results.length,interrupted:stale.results.length,completed,waiting};
}
