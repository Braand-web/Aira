import {AppError} from './core.mjs';
import {authorize,auditLog,config,db,getResource,uid} from './server';
import type {BillingIdentity} from './billing';
import {digest,workInput,type WorkInput} from './platform-contracts';
import {getWork,workReadiness,workCosts} from './work';
import {routineInput,routineCommand,nextRoutineSlot,type RoutineDTO,type RoutineStatus} from './routine-contracts';
const q=(sql:string,...args:(string|number|null)[])=>db().prepare(sql).bind(...args);
type Row={id:string;workspace_id:string;organization_id:string;actor_id:string;source_work_id:string;title:string;template_json:string;template_digest:string;interval_hours:number;first_at:number;next_at:number;expires_at:number;max_runs:number;budget_units:number;per_run_units:number;status:RoutineStatus;version:number;approved_by:string|null;error_code:string|null};
export function routineReadiness(){const c=config();return {ready:c.ROUTINES_ENABLED==='true'&&c.ROUTINES_STAGING_VERIFIED==='true'&&workReadiness().enabled,scope:'finite_approved_work_repetitions',externalWrites:'separate_exact_approval_required'};}
async function owned(tenant:string,id:string){const row=await q('SELECT * FROM agent_routines WHERE id=? AND workspace_id=?',id,tenant).first<Row>();if(!row)throw new AppError('Routine introuvable.',404,'routine_not_found');return row;}
type RunRow=RoutineDTO['runs'][number]&{routine_id:string};
type CostRow={routine_id:string;spent:number;reserved:number};
function dto(r:Row,runs:RoutineDTO['runs'],cost?:CostRow):RoutineDTO{
    const plan=workInput.parse(JSON.parse(r.template_json));
    return {id:r.id,title:r.title,sourceWorkId:r.source_work_id,status:r.status,version:r.version,digest:r.template_digest,intervalHours:r.interval_hours,timezone:plan.timezone,firstRunAt:r.first_at,nextAt:r.next_at,expiresAt:r.expires_at,maxRuns:r.max_runs,maxCredits:r.budget_units/100,perRunCredits:r.per_run_units/100,committedCredits:runs.length*r.per_run_units/100,spentCredits:(cost?.spent||0)/100,reservedCredits:(cost?.reserved||0)/100,objective:plan.objective,criteria:plan.steps.flatMap(s=>s.criteria),errorCode:r.error_code,runs};
}
async function related(rows:Row[]){
    if(!rows.length)return {runs:[] as RunRow[],costs:[] as CostRow[]};
    const ids=rows.map(r=>r.id),slots=ids.map(()=>'?').join(',');
    const runs=(await q(`SELECT x.routine_id,x.work_id workId,x.ordinal,x.scheduled_at scheduledAt,w.status,w.objective FROM agent_routine_runs x JOIN agent_work w ON w.id=x.work_id WHERE x.routine_id IN (${slots}) ORDER BY ordinal DESC`,...ids).all<RunRow>()).results;
    const costs=(await q(`SELECT x.routine_id,COALESCE(SUM(CASE WHEN h.status='settled' THEN h.actual ELSE 0 END),0) spent,COALESCE(SUM(CASE WHEN h.status='settled' THEN 0 ELSE a.max_units END),0) reserved FROM agent_routine_runs x JOIN agent_work_allocations a ON a.work_id=x.work_id LEFT JOIN credit_holds h ON h.id=a.hold_id WHERE x.routine_id IN (${slots}) GROUP BY x.routine_id`,...ids).all<CostRow>()).results;
    return {runs,costs};
}
export async function getRoutine(tenant:string,id:string):Promise<RoutineDTO>{const r=await owned(tenant,id),data=await related([r]);return dto(r,data.runs,data.costs[0]);}
// Three bounded queries regardless of routine/occurrence count; no polling N+1.
export async function listRoutines(tenant:string){const rows=(await q('SELECT * FROM agent_routines WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 40',tenant).all<Row>()).results,data=await related(rows);return {items:rows.map(r=>dto(r,data.runs.filter(x=>x.routine_id===r.id),data.costs.find(x=>x.routine_id===r.id))),readiness:routineReadiness()};}
async function requireVerifiedArtifacts(tenant:string,workId:string){
    const check=await q("SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN (SELECT json_extract(v.result,'$.status') FROM agent_verifications v WHERE v.workspace_id=r.workspace_id AND v.resource_id=r.id AND v.resource_version=r.version ORDER BY v.created_at DESC,v.rowid DESC LIMIT 1)='structurally_verified' THEN 1 ELSE 0 END),0) verified FROM resources r JOIN agent_work_artifacts a ON a.resource_id=r.id WHERE a.work_id=? AND r.workspace_id=? AND r.kind IN ('deliverable','page') AND r.status!='deleted'",workId,tenant).first<{total:number;verified:number}>();
    if(!check?.total||check.total!==check.verified)throw new AppError('Un livrable enregistré avec sa vérification structurelle actuelle est requis.',409,'routine_verification_required');
}
export async function prepareRoutine(who:BillingIdentity,input:unknown){
    await authorize(who.tenant,who.user.userId,'write');const p=routineInput.parse(input),source=await getWork(who.tenant,p.sourceWorkId),now=Date.now();
    if(source.status!=='completed'||source.version!==p.sourceVersion||source.unresolved||source.reservedCredits)throw new AppError('Choisissez la version actuelle d’un travail terminé et rapproché.',409,'routine_source_unfinished');
    // A successful label or text response alone is insufficient for a repeatable method.
    await requireVerifiedArtifacts(who.tenant,source.id);
    if(p.firstRunAt<now+60000||p.expiresAt<=p.firstRunAt||p.expiresAt>now+30*86400000||p.firstRunAt+(p.maxRuns-1)*p.intervalHours*3600000>=p.expiresAt)throw new AppError('Les exécutions doivent tenir dans les trente prochains jours, avec un premier départ dans au moins une minute.');
    if(source.maxCredits*p.maxRuns>p.maxCredits)throw new AppError('Le budget total doit couvrir le plafond de chaque répétition.',400,'routine_budget_exceeded');
    const rows=(await q('SELECT id,title,instruction,criteria,depends_on,max_units FROM agent_work_steps WHERE work_id=? ORDER BY ordinal',source.id).all<{id:string;title:string;instruction:string;criteria:string;depends_on:string;max_units:number}>()).results;
    const keys=new Map(rows.map((s,i)=>[s.id,'s'+i]));
    const template=workInput.parse({objective:source.objective,constraints:source.constraints,language:source.language,timezone:source.timezone,researchDepth:source.researchDepth,maxCredits:source.maxCredits,expiresAt:p.expiresAt,steps:rows.map(s=>({id:keys.get(s.id),title:s.title,instruction:s.instruction,criteria:JSON.parse(s.criteria),dependsOn:(JSON.parse(s.depends_on) as string[]).map(id=>keys.get(id)),maxCredits:s.max_units/100}))});
    const snapshot=JSON.stringify(template),hash=await digest({template,...p}),id=uid();
    await db().batch([
        q("INSERT INTO resources(id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,'routine',?,?,'draft',?,?)",id,who.tenant,p.title,JSON.stringify({sourceWorkId:source.id}),now,now),
        q('INSERT INTO agent_routines(id,workspace_id,organization_id,actor_id,source_work_id,title,template_json,template_digest,interval_hours,first_at,next_at,expires_at,max_runs,budget_units,per_run_units,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,who.tenant,who.organization,who.user.userId,source.id,p.title,snapshot,hash,p.intervalHours,p.firstRunAt,p.firstRunAt,p.expiresAt,p.maxRuns,p.maxCredits*100,source.maxCredits*100,now,now),
    ]);
    await auditLog(who.tenant,who.user.userId,'routine.prepared',id,{sourceWorkId:source.id,digest:hash});
    return {...await getResource(who.tenant,id),routine:await getRoutine(who.tenant,id)};
}
export async function commandRoutine(who:BillingIdentity,id:string,input:unknown){
    const p=routineCommand.parse(input),r=await owned(who.tenant,id),now=Date.now();
    await authorize(who.tenant,who.user.userId,['activate','resume'].includes(p.action)?'approve':'write');
    if(p.version!==r.version||p.digest!==r.template_digest)throw new AppError('La routine a changé. Relisez son mandat.',409,'stale_version');
    if(['cancelled','completed','expired'].includes(r.status))throw new AppError('Cette routine est terminée.',409,'routine_finished');
    if(p.action==='activate'||p.action==='resume'){
        if(!routineReadiness().ready)throw new AppError('Le calendrier des routines attend sa validation. Le brouillon est conservé.',503,'routine_not_ready');
        if(p.approved!==true||p.action==='activate'&&r.status!=='draft'||p.action==='resume'&&!['paused','blocked'].includes(r.status))throw new AppError('Approuvez le mandat exact de la routine.',409,'routine_approval_required');
        if(r.expires_at<=now||p.action==='activate'&&r.first_at<=now)throw new AppError('Le calendrier a expiré. Préparez une nouvelle routine.',409,'routine_expired');
        await authorize(who.tenant,r.actor_id,'write');
        const unfinished=await q("SELECT 1 FROM agent_routine_runs x JOIN agent_work w ON w.id=x.work_id WHERE x.routine_id=? AND w.status!='completed' LIMIT 1",id).first();
        if(unfinished)throw new AppError('Examinez et terminez le travail précédent avant la reprise. Aucun travail incertain ne sera répété.',409,'routine_previous_unfinished');
    }
    if(p.action==='pause'&&!['active','blocked'].includes(r.status))throw new AppError('Cette routine ne peut pas être mise en pause.',409);
    const status=p.action==='cancel'?'cancelled':p.action==='pause'?'paused':'active',next=p.action==='resume'?nextRoutineSlot(r.first_at,r.interval_hours,now):r.next_at;
    // Compare-and-swap and child stop are one D1 transaction. A tick cannot sneak
    // an extra iteration between the parent's pause and the child's stop.
    const result=await db().batch([
        q('UPDATE agent_routines SET status=?,version=version+1,approved_by=?,approved_at=?,next_at=?,error_code=NULL,updated_at=? WHERE id=? AND workspace_id=? AND version=?',status,['activate','resume'].includes(p.action)?who.user.userId:r.approved_by,now,next,now,id,who.tenant,p.version),
        q("UPDATE agent_work SET status=?,version=version+1,updated_at=? WHERE id IN (SELECT work_id FROM agent_routine_runs WHERE routine_id=?) AND status NOT IN ('completed','cancelled','expired') AND EXISTS(SELECT 1 FROM agent_routines WHERE id=? AND version=? AND status=?)",p.action==='cancel'?'cancelled':'paused',now,id,id,p.version+1,status),
        q('UPDATE resources SET status=?,version=version+1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM agent_routines WHERE id=? AND version=? AND status=?)',status,now,id,id,p.version+1,status),
        q('UPDATE resources SET status=(SELECT status FROM agent_work WHERE agent_work.id=resources.id),updated_at=? WHERE id IN (SELECT work_id FROM agent_routine_runs WHERE routine_id=?)',now,id),
    ]);
    if(!result[0].meta.changes)throw new AppError('La routine a changé.',409,'stale_version');
    await auditLog(who.tenant,who.user.userId,'routine.'+p.action,id,{version:p.version,digest:p.digest});return getRoutine(who.tenant,id);
}
async function stop(r:Row,status:RoutineStatus,code:string|null){const now=Date.now();await db().batch([q("UPDATE agent_routines SET status=?,error_code=?,version=version+1,updated_at=? WHERE id=? AND status='active' AND version=?",status,code,now,r.id,r.version),q('UPDATE resources SET status=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM agent_routines WHERE id=? AND status=?)',status,now,r.id,r.id,status)]);}
export async function runRoutineTick(){
    if(!routineReadiness().ready)return {disabled:true,created:0};
    const now=Date.now(),rows=(await q("SELECT * FROM agent_routines WHERE status='active' AND next_at<=? ORDER BY next_at,id LIMIT 10",now).all<Row>()).results;let created=0;
    for(const r of rows){
        try{
            await authorize(r.workspace_id,r.actor_id,'write');if(!r.approved_by)throw new AppError('Approbation absente.',403);await authorize(r.workspace_id,r.approved_by,'approve');
            const runs=(await q('SELECT x.ordinal,w.id,w.status FROM agent_routine_runs x JOIN agent_work w ON w.id=x.work_id WHERE x.routine_id=? ORDER BY x.ordinal DESC',r.id).all<{ordinal:number;id:string;status:string}>()).results;
            const last=runs[0];
            if(last&&last.status!=='completed'){
                if(['running','waiting_external'].includes(last.status)&&r.expires_at>now)continue;
                await stop(r,'blocked','routine_previous_unfinished');continue;
            }
            if(last){const cost=await workCosts(last.id);if(cost.reserved||cost.unresolved){await stop(r,'blocked','routine_usage_pending');continue;}await requireVerifiedArtifacts(r.workspace_id,last.id);}
            if(runs.length>=r.max_runs){await stop(r,'completed',null);continue;}
            if(r.expires_at<=now){await stop(r,'expired','routine_expired');continue;}
            const plan:WorkInput=workInput.parse(JSON.parse(r.template_json)),ordinal=runs.length+1,workId=uid(),conversationId=uid(),next=nextRoutineSlot(r.first_at,r.interval_hours,now);
            const expires=Math.min(r.expires_at,now+Math.min(r.interval_hours,24)*3600000),title=r.title+' · '+ordinal;
            // All inserts are conditional on one exact parent state. IDs live only
            // in this transaction. Concurrent or repeated ticks cannot duplicate it.
            const predicate="EXISTS(SELECT 1 FROM agent_routines WHERE id=? AND status='active' AND version=? AND next_at=? AND expires_at>? AND (SELECT COUNT(*) FROM agent_routine_runs WHERE routine_id=?)=?)";
            const guard=[r.id,r.version,r.next_at,now,r.id,runs.length] as const;
            const result=await db().batch([
                q("INSERT INTO resources(id,workspace_id,kind,title,data,status,created_at,updated_at) SELECT ?,?,'conversation',?,?,'saved',?,? WHERE "+predicate,conversationId,r.workspace_id,title,JSON.stringify({routineId:r.id,ordinal}),now,now,...guard),
                q("INSERT INTO resources(id,workspace_id,kind,title,data,status,created_at,updated_at) SELECT ?,?,'work',?,?,'running',?,? WHERE "+predicate,workId,r.workspace_id,title,JSON.stringify({objective:plan.objective,conversationId,routineId:r.id}),now,now,...guard),
                q("INSERT INTO agent_work(id,workspace_id,organization_id,actor_id,conversation_id,objective,constraints_json,language,timezone,research_depth,status,approved_version,budget_units,expires_at,next_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,'running',1,?,?,?,?,? WHERE "+predicate,workId,r.workspace_id,r.organization_id,r.actor_id,conversationId,plan.objective,JSON.stringify([...plan.constraints,`Routine ${r.id}, occurrence ${ordinal}, déclenchement ${new Date(now).toISOString()}. Récupérer des données actuelles ; ne pas présenter les anciens chiffres comme nouveaux. Les anciens accords externes ne sont pas réutilisables.`]),plan.language,plan.timezone,plan.researchDepth,r.per_run_units,expires,now,now,now,...guard),
                ...plan.steps.map((s,i)=>q('INSERT INTO agent_work_steps(id,work_id,ordinal,title,instruction,criteria,depends_on,max_units) SELECT ?,?,?,?,?,?,?,? WHERE '+predicate,workId+':'+s.id,workId,i,s.title,s.instruction,JSON.stringify(s.criteria),JSON.stringify(s.dependsOn.map(d=>workId+':'+d)),s.maxCredits*100,...guard)),
                q("INSERT INTO agent_work_outbox(id,work_id,next_at,created_at) SELECT ?,?,?,? WHERE "+predicate,uid(),workId,now,now,...guard),
                q('INSERT INTO agent_routine_runs(routine_id,ordinal,scheduled_at,work_id,created_at) SELECT ?,?,?,?,? WHERE '+predicate,r.id,ordinal,r.next_at,workId,now,...guard),
                q("UPDATE agent_routines SET next_at=?,updated_at=? WHERE id=? AND status='active' AND version=? AND next_at=? AND EXISTS(SELECT 1 FROM agent_routine_runs WHERE work_id=?)",next,now,r.id,r.version,r.next_at,workId),
            ]);
            if(result[0].meta.changes){created++;await auditLog(r.workspace_id,r.actor_id,'routine.triggered',r.id,{ordinal,workId,scheduledAt:r.next_at});}
        }catch(error){await stop(r,'blocked',error instanceof AppError?error.code:'routine_tick_failed');}
    }
    return {checked:rows.length,created};
}
