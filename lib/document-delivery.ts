import {z} from 'zod';
import {authorize,config,db,getResource,getClientResource,uid,auditLog} from './server';
import {AppError,safeFilename} from './core.mjs';
import {renderDocument,exportFormats} from './document-export.mjs';
import {FILE_POLICY} from './file-policy.mjs';
import type {BillingIdentity} from './billing';
const input=z.object({id:z.string().min(1).max(160),version:z.number().int().positive(),format:z.enum(['md','html','csv','docx','xlsx','pdf','pptx'])}).strict();
export {exportFormats};
export async function buildDocument(tenant:string,raw:unknown){
 const p=input.parse(raw),source=await getResource(tenant,p.id);
 if(source.kind!=='deliverable'||source.status==='deleted')throw new AppError('Livrable introuvable.',404);
 if(source.version!==p.version)throw new AppError('Le livrable a changé. Actualisez avant de l’exporter.',409,'stale_version');
 const data=z.object({content:z.string().min(1).max(18000),sources:z.array(z.string().max(500)).max(12).default([])}).parse(source.data);
 try{return {...renderDocument(p.format,source.title,data.content,data.sources),name:safeFilename(source.title)+'.'+p.format,source,p};}
 catch(error){throw new AppError(error instanceof RangeError?error.message:'Le document n’a pas pu être exporté.',422,'document_export_unsupported');}
}
export async function exportDeliverable(who:BillingIdentity,raw:unknown){
 await authorize(who.tenant,who.user.userId,'write');
 const output=await buildDocument(who.tenant,raw),bucket=config().BUCKET;
 if(!bucket)throw new AppError('Stockage des fichiers indisponible.',503);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',output.bytes.slice().buffer as ArrayBuffer)),n=>n.toString(16).padStart(2,'0')).join('');
 const existing=await db().prepare("SELECT id FROM files WHERE workspace_id=? AND sha256=? AND status='ready'").bind(who.tenant,hash).first<{id:string}>();
 if(existing)return getClientResource(who.tenant,existing.id);
 const count=await db().prepare("SELECT COUNT(*) total FROM files WHERE workspace_id=? AND status!='deleted'").bind(who.tenant).first<{total:number}>();
 if((count?.total||0)>=FILE_POLICY.legacyMaxFilesPerWorkspace)throw new AppError('La limite de fichiers de cet espace est atteinte.',429,'file_quota_exceeded');
 const id=uid(),key=who.tenant+'/'+id+'/'+output.name,now=Date.now(),mime=['md','html','csv'].includes(output.p.format)?'text/plain':output.mime;
 await bucket.put(key,output.bytes,{httpMetadata:{contentType:mime}});
 try{await db().batch([
  db().prepare("UPDATE files SET sha256=NULL WHERE workspace_id=? AND sha256=? AND status='deleted'").bind(who.tenant,hash),
  db().prepare("INSERT INTO resources(id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,'file',?,?,'ready',?,?)").bind(id,who.tenant,output.name,JSON.stringify({mime,size:output.bytes.length,sha256:hash,format:output.p.format,sourceId:output.source.id,sourceVersion:output.source.version}),now,now),
  db().prepare("INSERT INTO files(id,workspace_id,owner_id,display_name,storage_name,size_bytes,detected_mime,sha256,status,storage_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'ready',?,?,?)").bind(id,who.tenant,who.user.userId,output.name,output.name,output.bytes.length,mime,hash,key,now,now),
  db().prepare('INSERT INTO billing_meter VALUES (?,?,?,?,?)').bind(uid(),who.organization,'storage',output.bytes.length,now),
  db().prepare("INSERT INTO file_upload_audit(id,workspace_id,actor_id,file_id,action,created_at) VALUES (?,?,?,?,'generated',?)").bind(uid(),who.tenant,who.user.userId,id,now)
 ]);}catch(error){await bucket.delete(key);const duplicate=await db().prepare("SELECT id FROM files WHERE workspace_id=? AND sha256=? AND status='ready'").bind(who.tenant,hash).first<{id:string}>();if(duplicate)return getClientResource(who.tenant,duplicate.id);throw error;}
 await auditLog(who.tenant,who.user.userId,'deliverable.exported',id,{sourceId:output.source.id,version:output.source.version,format:output.p.format});
 return getClientResource(who.tenant,id);
}
