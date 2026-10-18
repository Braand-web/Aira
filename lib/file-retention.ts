import {env} from "cloudflare:workers";
import {db,uid} from "@/lib/server";
import {FILE_POLICY,purgeAttachmentSnapshot} from "@/lib/file-policy.mjs";
import type {FileRecord} from "@/lib/contracts";

type ExpiredFile=FileRecord&{organization_id:string|null};
type ExpiredUpload={id:string;workspace_id:string;file_id:string;storage_key:string;multipart_upload_id:string};

async function purgeMessageSnapshots(tenant:string,fileId:string){
 let removed=0;
 while(true){
  const rows=await db().prepare("SELECT id,content,attachments FROM messages WHERE workspace_id=? AND EXISTS (SELECT 1 FROM json_each(messages.attachments) WHERE value=?) ORDER BY created_at LIMIT ?")
   .bind(tenant,fileId,FILE_POLICY.retentionMessageBatchSize).all<{id:string;content:string;attachments:string}>();
  if(!rows.results.length)break;
  const updates=rows.results.flatMap(message=>{const purged=purgeAttachmentSnapshot(message.content,message.attachments,fileId);return purged?[db().prepare("UPDATE messages SET content=?,attachments=? WHERE id=? AND workspace_id=?").bind(purged.content,purged.attachments,message.id,tenant)]:[];});
  if(!updates.length)break;
  await db().batch(updates);removed+=updates.length;
 }
 return removed;
}

export async function purgeExpiredFiles(now=Date.now()){
 if(!env.BUCKET)return {deleted:0,skipped:"storage_unavailable"};
 const cutoff=now-FILE_POLICY.softDeleteRetentionMs;
 await db().prepare("DELETE FROM file_upload_limits WHERE window_start<?").bind(now-FILE_POLICY.uploadLimitRetentionMs).run();
 await db().prepare("DELETE FROM file_upload_part_limits WHERE window_start<?").bind(now-FILE_POLICY.uploadLimitRetentionMs).run();
 const rows=await db().prepare("SELECT f.*,w.organization_id FROM files f JOIN workspaces w ON w.id=f.workspace_id WHERE f.status='deleted' AND f.deleted_at<? AND (f.storage_key IS NOT NULL OR f.thumbnail_key IS NOT NULL OR f.extraction_key IS NOT NULL) ORDER BY f.deleted_at LIMIT ?")
  .bind(cutoff,FILE_POLICY.retentionDeleteBatchSize).all<ExpiredFile>();
 let deleted=0;
 for(const file of rows.results){
  for(const key of [file.storage_key,file.thumbnail_key,file.extraction_key])if(key)await env.BUCKET.delete(key);
  await purgeMessageSnapshots(file.workspace_id,file.id);
  const nowUpdated=Date.now(),statements=[
   db().prepare("UPDATE files SET storage_key=NULL,thumbnail_key=NULL,extraction_key=NULL,updated_at=? WHERE id=? AND workspace_id=? AND status='deleted'").bind(nowUpdated,file.id,file.workspace_id),
   db().prepare("UPDATE resources SET data='{}',updated_at=? WHERE id=? AND workspace_id=? AND kind='file' AND status='deleted'").bind(nowUpdated,file.id,file.workspace_id),
   db().prepare("INSERT OR IGNORE INTO billing_meter VALUES (?,?,?,?,?)").bind("file-retention:"+file.id,file.organization_id,"storage",-Number(file.size_bytes||0),nowUpdated),
   db().prepare("INSERT INTO file_upload_audit (id,workspace_id,actor_id,file_id,action,created_at) VALUES (?,?,NULL,?,'permanently_deleted',?)").bind(uid(),file.workspace_id,file.id,nowUpdated),
  ];
  await db().batch(statements);deleted++;
 }
 return {deleted};
}

export async function purgeExpiredUploads(now=Date.now()){
 if(!env.BUCKET)return {deleted:0,skipped:"storage_unavailable"};
 const rows=await db().prepare("SELECT id,workspace_id,file_id,storage_key,multipart_upload_id FROM file_upload_sessions WHERE expires_at<? AND (status='uploading' OR (status='validating' AND updated_at<?)) ORDER BY expires_at LIMIT ?")
  .bind(now,now-FILE_POLICY.uploadFinalizeLeaseMs,FILE_POLICY.retentionDeleteBatchSize).all<ExpiredUpload>();
 let deleted=0;
 for(const upload of rows.results){
  const lock=await db().prepare("UPDATE file_upload_sessions SET status='aborted',updated_at=? WHERE id=? AND workspace_id=? AND expires_at<? AND (status='uploading' OR (status='validating' AND updated_at<?))")
   .bind(now,upload.id,upload.workspace_id,now,now-FILE_POLICY.uploadFinalizeLeaseMs).run();
  if(!lock.meta.changes)continue;
  try{await env.BUCKET.resumeMultipartUpload(upload.storage_key,upload.multipart_upload_id).abort();}catch{}
  try{await env.BUCKET.delete(upload.storage_key);}catch{}
  await db().batch([
   db().prepare("DELETE FROM file_upload_sessions WHERE id=? AND workspace_id=? AND status='aborted'").bind(upload.id,upload.workspace_id),
   db().prepare("DELETE FROM files WHERE id=? AND workspace_id=? AND status='uploading'").bind(upload.file_id,upload.workspace_id),
   db().prepare("INSERT INTO file_upload_audit (id,workspace_id,actor_id,file_id,action,created_at) VALUES (?, ?,NULL,?,'incomplete_upload_expired',?)").bind(uid(),upload.workspace_id,upload.file_id,now),
  ]);
  deleted++;
 }
 return {deleted};
}
