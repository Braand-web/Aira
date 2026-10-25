import {db} from './server';
import {AppError} from './core.mjs';
async function receiptScope(tenant:string,runId:string){
 if(runId.startsWith('work:')){const row=await db().prepare('SELECT a.work_id FROM agent_work_allocations a JOIN agent_work w ON w.id=a.work_id WHERE a.reference=? AND w.workspace_id=?').bind('chat:'+runId,tenant).first<{work_id:string}>();if(!row)throw new AppError('Contexte de travail introuvable.',409);return {table:'agent_work_tool_receipts',column:'work_id',id:row.work_id};}
 return {table:'agent_tool_receipts',column:'run_id',id:runId};
}
export async function claimLocalTool(tenant:string,runId:string,name:string,key:string){
 const scope=await receiptScope(tenant,runId);
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),v=>v.toString(16).padStart(2,'0')).join('');
 const previous=await db().prepare(`SELECT status,result FROM ${scope.table} WHERE workspace_id=? AND ${scope.column}=? AND fingerprint=?`).bind(tenant,scope.id,fingerprint).first<{status:string;result:string|null}>();
 if(previous){if(previous.status==='confirmed'&&previous.result)return {fingerprint,reused:true,result:JSON.parse(previous.result)};throw new AppError('Une modification précédente attend un rapprochement. Aucun appel ne sera répété.',409,'tool_result_uncertain');}
 const claim=await db().prepare(`INSERT OR IGNORE INTO ${scope.table}(workspace_id,${scope.column},fingerprint,tool,status,updated_at) VALUES (?,?,?,?,'pending',?)`).bind(tenant,scope.id,fingerprint,name,Date.now()).run();
 if(!claim.meta.changes)throw new AppError('Cette modification est déjà en cours.',409,'tool_result_uncertain');return {fingerprint,reused:false,result:undefined};
}
export async function confirmLocalTool(tenant:string,runId:string,fingerprint:string,result:unknown){const scope=await receiptScope(tenant,runId);await db().prepare(`UPDATE ${scope.table} SET status='confirmed',result=?,updated_at=? WHERE workspace_id=? AND ${scope.column}=? AND fingerprint=? AND status='pending'`).bind(JSON.stringify(result),Date.now(),tenant,scope.id,fingerprint).run();}
export async function failLocalTool(tenant:string,runId:string,fingerprint:string,knownNoWrite:boolean){
 const scope=await receiptScope(tenant,runId);
 if(knownNoWrite)await db().prepare(`DELETE FROM ${scope.table} WHERE workspace_id=? AND ${scope.column}=? AND fingerprint=? AND status='pending'`).bind(tenant,scope.id,fingerprint).run();
 else await db().prepare(`UPDATE ${scope.table} SET status='uncertain',updated_at=? WHERE workspace_id=? AND ${scope.column}=? AND fingerprint=? AND status='pending'`).bind(Date.now(),tenant,scope.id,fingerprint).run();
}

export async function confirmedHistoricalReceipt(tenant:string,runId:string,tool:string,input:unknown){
 const scope=await receiptScope(tenant,runId);
 const key=tool+':'+JSON.stringify(input,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),v=>v.toString(16).padStart(2,'0')).join('');
 const receipt=await db().prepare(`SELECT result FROM ${scope.table} WHERE workspace_id=? AND ${scope.column}=? AND fingerprint=? AND tool=? AND status='confirmed'`).bind(tenant,scope.id,fingerprint,tool).first<{result:string}>();return receipt?JSON.parse(receipt.result):null;
}
