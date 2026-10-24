import {db} from './server';
import {AppError} from './core.mjs';
export async function claimLocalTool(tenant:string,runId:string,name:string,key:string){
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),v=>v.toString(16).padStart(2,'0')).join('');
 const previous=await db().prepare('SELECT status,result FROM agent_tool_receipts WHERE workspace_id=? AND run_id=? AND fingerprint=?').bind(tenant,runId,fingerprint).first<{status:string;result:string|null}>();
 if(previous){if(previous.status==='confirmed'&&previous.result)return {fingerprint,reused:true,result:JSON.parse(previous.result)};throw new AppError('Une modification précédente attend un rapprochement. Aucun appel ne sera répété.',409,'tool_result_uncertain');}
 const claim=await db().prepare("INSERT OR IGNORE INTO agent_tool_receipts(workspace_id,run_id,fingerprint,tool,status,updated_at) VALUES (?,?,?,?,'pending',?)").bind(tenant,runId,fingerprint,name,Date.now()).run();
 if(!claim.meta.changes)throw new AppError('Cette modification est déjà en cours.',409,'tool_result_uncertain');return {fingerprint,reused:false,result:undefined};
}
export async function confirmLocalTool(tenant:string,runId:string,fingerprint:string,result:unknown){await db().prepare("UPDATE agent_tool_receipts SET status='confirmed',result=?,updated_at=? WHERE workspace_id=? AND run_id=? AND fingerprint=? AND status='pending'").bind(JSON.stringify(result),Date.now(),tenant,runId,fingerprint).run();}
export async function failLocalTool(tenant:string,runId:string,fingerprint:string,knownNoWrite:boolean){
 if(knownNoWrite)await db().prepare("DELETE FROM agent_tool_receipts WHERE workspace_id=? AND run_id=? AND fingerprint=? AND status='pending'").bind(tenant,runId,fingerprint).run();
 else await db().prepare("UPDATE agent_tool_receipts SET status='uncertain',updated_at=? WHERE workspace_id=? AND run_id=? AND fingerprint=? AND status='pending'").bind(Date.now(),tenant,runId,fingerprint).run();
}

export async function confirmedHistoricalReceipt(tenant:string,runId:string,tool:string,input:unknown){
 const key=tool+':'+JSON.stringify(input,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),v=>v.toString(16).padStart(2,'0')).join('');
 const receipt=await db().prepare("SELECT result FROM agent_tool_receipts WHERE workspace_id=? AND run_id=? AND fingerprint=? AND tool=? AND status='confirmed'").bind(tenant,runId,fingerprint,tool).first<{result:string}>();return receipt?JSON.parse(receipt.result):null;
}
