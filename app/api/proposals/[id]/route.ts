import {z} from 'zod';
import {identity,getResource,db,updateResource,failure,auditLog,config,authorize} from '@/lib/server';
import {AppError,assertVersion,validateMediaInput} from '@/lib/core.mjs';
import {falCatalog,submitFal,falResult} from '@/lib/providers';
import {reserve,settleHold} from '@/lib/billing';
import {hasCurrentMediaPrice} from '@/lib/execution-policy.mjs';
import {proposalSchema} from '@/lib/contracts';
import {mediaQuoteFingerprint} from '@/lib/media-routing.mjs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{
 const who=await identity(request,'approve'),{tenant}=who,{id}=await context.params;
 const {version}=z.object({version:z.number().int()}).parse(await request.json());
 const resource=await getResource(tenant,id),opId=id+':'+version;
 const previous=await db().prepare('SELECT id,status FROM operations WHERE id=? AND workspace_id=?').bind(opId,tenant).first();
 if(previous)return Response.json({operation:previous,replayed:true});
 assertVersion(resource.version,version);
 if(resource.kind!=='proposal'||resource.data.kind!=='media'||resource.status!=='awaiting_approval')throw new AppError('Proposition média à valider requise.',409);
 if(!config().FAL_KEY)throw new AppError('fal.ai non configuré.',503);
 const proposal=proposalSchema.parse(resource.data),payload=z.object({model:z.string(),input:z.record(z.unknown()),quoteFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional()}).parse(proposal.payload);
 const model=falCatalog().find(m=>m.id===payload.model),amount=proposal.maxCredits;
 if(!model||model.credits!==amount)throw new AppError('Le tarif a changé. Une nouvelle proposition est nécessaire.',409);
 if(!hasCurrentMediaPrice(model,amount))throw new AppError('Le coût de ce modèle doit être vérifié avant génération.',503);
 if(payload.quoteFingerprint&&payload.quoteFingerprint!==await mediaQuoteFingerprint(model,payload.input))throw new AppError('Le modèle, ses paramètres ou son tarif ont changé. Une nouvelle proposition est nécessaire.',409,'media_stale_quote');
 validateMediaInput(payload.input,model.inputSchema);
 const hold=await reserve(who,'media:'+opId,amount*100);
 const claim=await db().prepare("INSERT OR IGNORE INTO operations (id,workspace_id,resource_id,status,amount,detail,created_at,updated_at) VALUES (?,?,?,'submitting',?,?,?,?)").bind(opId,tenant,id,amount,JSON.stringify({model:model.id,holdId:hold.id,costCeilingXaf:model.costCeilingXaf}),Date.now(),Date.now()).run();
 if(!claim.meta.changes)return Response.json({operationId:opId,replayed:true});
 try{
  await authorize(tenant,who.user.userId,'approve');
  const externalId=await submitFal(model.id,payload.input);
  await db().prepare("UPDATE operations SET status='waiting_external',external_id=?,updated_at=? WHERE id=?").bind(externalId,Date.now(),opId).run();
  await db().prepare("INSERT OR IGNORE INTO provider_usage(id,organization_id,workspace_id,run_id,hold_id,provider,role,request_id,rate,usage,status,created_at) VALUES (?,?,?,?,?,'fal','creative',?,?,?,'unknown',?)").bind('fal:'+opId,who.organization,tenant,opId,hold.id,externalId,JSON.stringify({costCeilingXaf:model.costCeilingXaf,verifiedAt:model.verifiedAt}),JSON.stringify({model:model.id}),Date.now()).run();
  await updateResource(tenant,id,version,{status:'generating'});
  await auditLog(tenant,who.user.userId,'media.approved',id,{version,maxCredits:amount});
  return Response.json({operationId:opId,status:'waiting_external'});
 }catch(error){
  if(error instanceof AppError&&(error.code==='fal_rejected'||error.status===403)){
   await settleHold(hold.id,0);await db().prepare("UPDATE operations SET status='rejected',updated_at=? WHERE id=?").bind(Date.now(),opId).run();throw error;
  }
  await db().prepare("UPDATE operations SET status='needs_reconciliation',updated_at=? WHERE id=? AND status='submitting'").bind(Date.now(),opId).run();
  throw new AppError('Réponse fournisseur incertaine. Réservation conservée ; aucun nouvel envoi automatique.',502,'needs_reconciliation');
 }
 }catch(error){return failure(error);}}
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{
 const {tenant}=await identity(request),{id}=await context.params,resource=await getResource(tenant,id);
 const op=await db().prepare('SELECT * FROM operations WHERE resource_id=? AND workspace_id=? ORDER BY created_at DESC LIMIT 1').bind(id,tenant).first<{id:string;status:string;detail:string;external_id:string;amount:number}>();
 if(!op)return Response.json({status:resource.status});
 const mediaId='media:'+op.id;
 if(op.status==='completed')return Response.json({status:'COMPLETED',resourceId:mediaId});
 if(!['waiting_external','settling'].includes(op.status))return Response.json({status:op.status});
 let detail=JSON.parse(op.detail||'{}');
 if(op.status==='waiting_external'){
  const result=await falResult(detail.model,op.external_id);if(result.status!=='COMPLETED')return Response.json(result);
  detail={...detail,output:result.output};
  await db().prepare("UPDATE operations SET status='settling',detail=?,updated_at=? WHERE id=? AND status='waiting_external'").bind(JSON.stringify(detail),Date.now(),op.id).run();
 }
 const now=Date.now();
 await db().prepare("INSERT OR IGNORE INTO resources (id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,'media',?,?,'ready',?,?)").bind(mediaId,tenant,resource.title,JSON.stringify({output:detail.output,model:detail.model,proposalId:id}),now,now).run();
 const hold=detail.holdId||(await db().prepare('SELECT id FROM credit_holds WHERE reference=?').bind('legacy:'+op.id).first<{id:string}>())?.id;
 if(!hold)throw new AppError('Réservation à rapprocher avant règlement.',409);
 await settleHold(hold,op.amount*100);
 await db().batch([
 db().prepare("UPDATE operations SET status='completed',updated_at=? WHERE id=? AND status='settling'").bind(now,op.id),
 db().prepare("UPDATE resources SET status='completed',version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND status!='completed'").bind(now,id,tenant)
 ]);return Response.json({status:'COMPLETED',resourceId:mediaId});
 }catch(error){return failure(error);}}
