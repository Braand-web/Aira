import {z} from "zod";
import {identity,getResource,db,uid,updateResource,failure,auditLog,config} from "@/lib/server";
import {AppError,assertVersion,validateModelInput} from "@/lib/core.mjs";
import {falCatalog,submitFal,falResult} from "@/lib/providers";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{
 const {tenant}=await identity(request),{id}=await context.params,{version}=z.object({version:z.number().int()}).parse(await request.json());
 const resource=await getResource(tenant,id);assertVersion(resource.version,version);
 if(resource.kind!=="proposal"||resource.data.kind!=="media")throw new AppError("Proposition média requise.");
 if(!config().FAL_KEY)throw new AppError("fal.ai non configuré.",503);
 const opId=id+":"+version,previous=await db().prepare("SELECT id,status FROM operations WHERE id=? AND workspace_id=?").bind(opId,tenant).first();
 if(previous)return Response.json({operation:previous,replayed:true});
 if(resource.status!=="awaiting_approval")throw new AppError("Cette proposition n’attend plus de validation.",409);
 const model=falCatalog().find(m=>m.id===resource.data.payload.model),amount=resource.data.maxCredits;
 if(!model||model.credits!==amount)throw new AppError("Le tarif a changé. Une nouvelle proposition est nécessaire.",409);
 validateModelInput(resource.data.payload.input,model.inputSchema);
 const batch=await db().batch([db().prepare("INSERT INTO operations (id,workspace_id,resource_id,status,amount,created_at,updated_at) VALUES (?,?,?,'reserving',?,?,?)").bind(opId,tenant,id,amount,Date.now(),Date.now()),db().prepare("UPDATE workspaces SET reserved=reserved+? WHERE id=? AND credits-reserved>=?").bind(amount,tenant,amount)]);
 if(!batch[1].meta.changes){await db().prepare("UPDATE operations SET status='insufficient_credits' WHERE id=?").bind(opId).run();throw new AppError("Crédits insuffisants. Aucun appel média effectué.",402);}
 await db().prepare("UPDATE operations SET status='submitting' WHERE id=?").bind(opId).run();await auditLog(tenant,"media.approved",id,{version,maxCredits:amount});
 try{
  const externalId=await submitFal(model.id,resource.data.payload.input);await db().prepare("UPDATE operations SET status='waiting_external',external_id=?,detail=?,updated_at=? WHERE id=?").bind(externalId,JSON.stringify({model:model.id}),Date.now(),opId).run();await updateResource(tenant,id,version,{status:"generating"});return Response.json({operationId:opId,status:"waiting_external"});
 }catch{await db().prepare("UPDATE operations SET status='needs_reconciliation',updated_at=? WHERE id=?").bind(Date.now(),opId).run();throw new AppError("Résultat fournisseur incertain. Réservation conservée pour rapprochement ; aucun nouvel essai automatique.",502,"needs_reconciliation");}
 }catch(error){return failure(error);}}
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{
 const {tenant}=await identity(request),{id}=await context.params,resource=await getResource(tenant,id);
 const op=await db().prepare("SELECT * FROM operations WHERE resource_id=? AND workspace_id=? ORDER BY created_at DESC LIMIT 1").bind(id,tenant).first<any>();
 if(!op)return Response.json({status:resource.status});if(op.status!=="waiting_external")return Response.json({status:op.status});
 const result=await falResult(JSON.parse(op.detail).model,op.external_id);if(result.status!=="COMPLETED")return Response.json(result);
 const lock=await db().prepare("UPDATE operations SET status='settling',detail=?,updated_at=? WHERE id=? AND status='waiting_external'").bind(JSON.stringify({...JSON.parse(op.detail),output:result.output}),Date.now(),op.id).run();if(!lock.meta.changes)return Response.json({status:"settling"});
 const mediaId=uid(),now=Date.now();
 await db().batch([db().prepare("INSERT INTO resources (id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,'media',?,?,'ready',?,?)").bind(mediaId,tenant,resource.title,JSON.stringify({output:result.output,model:JSON.parse(op.detail).model,proposalId:id}),now,now),db().prepare("UPDATE workspaces SET reserved=reserved-?,credits=credits-? WHERE id=? AND reserved>=?").bind(op.amount,op.amount,tenant,op.amount),db().prepare("UPDATE operations SET status='completed',updated_at=? WHERE id=? AND status='settling'").bind(now,op.id),db().prepare("UPDATE resources SET status='completed',version=version+1,updated_at=? WHERE id=? AND workspace_id=?").bind(now,id,tenant)]);
 await auditLog(tenant,"media.completed",mediaId,{credits:op.amount});return Response.json({status:"COMPLETED",resourceId:mediaId});
 }catch(error){return failure(error);}}

