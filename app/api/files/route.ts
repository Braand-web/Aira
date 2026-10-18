import {env} from "cloudflare:workers";
import {fileIdentity,getResource,failure,uid,db,config} from "@/lib/server";
import {AppError,safeFilename} from "@/lib/core.mjs";
import {FILE_POLICY,contentSecurityHeaders,declaredTypeMatches,detectFileType,imageWithinPixelLimit,safeResourceDto} from "@/lib/file-policy.mjs";
import type {FileRecord} from "@/lib/contracts";

const displayName=(name:string)=>name.normalize("NFC").replace(/[\u0000-\u001f\u007f]/gu,"").slice(0,FILE_POLICY.maxDisplayNameChars)||"Fichier";
const sha256=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes.slice().buffer as ArrayBuffer)),byte=>byte.toString(16).padStart(2,"0")).join("");

export async function POST(request:Request){try{
 const who=await fileIdentity(request),{tenant,organization,user}=who;if(!env.BUCKET)throw new AppError("Stockage des fichiers indisponible.",503);
 const declared=Number(request.headers.get("content-length")||0);if(declared>FILE_POLICY.legacyDirectRequestBytes)throw new AppError("Pour cet envoi direct, la limite temporaire est de 5 Mio. L’envoi de gros fichiers sera disponible avec le transfert reprenable.",413,"file_too_large");
 const data=await request.formData(),file=data.get("file");if(!(file instanceof File))throw new AppError("Fichier requis.");
 if(file.size>FILE_POLICY.maxFileBytes)throw new AppError(`Fichier trop volumineux : ${FILE_POLICY.maxFileSizeLabel} maximum.`,413,"file_too_large");
 if(file.size>FILE_POLICY.legacyDirectUploadBytes)throw new AppError(`Pour cet envoi direct, la limite temporaire est de ${FILE_POLICY.legacyDirectUploadSizeLabel}. L’envoi de gros fichiers sera disponible avec le transfert reprenable.`,413,"file_too_large");
 if(file.size===0)throw new AppError("Le fichier est vide.",415,"file_type_unsupported");
 const now=Date.now(),windowStart=Math.floor(now/FILE_POLICY.uploadRateWindowMs)*FILE_POLICY.uploadRateWindowMs;
 await db().prepare("DELETE FROM file_upload_limits WHERE user_id=? AND window_start<?").bind(user.userId,windowStart-FILE_POLICY.uploadLimitRetentionMs).run();
 const rate=await db().prepare("INSERT INTO file_upload_limits (user_id,window_start,count,bytes) VALUES (?,?,1,?) ON CONFLICT(user_id,window_start) DO UPDATE SET count=count+1,bytes=bytes+excluded.bytes WHERE count<? AND bytes+excluded.bytes<=?").bind(user.userId,windowStart,file.size,FILE_POLICY.maxUploadsPerUserPerWindow,FILE_POLICY.maxUploadBytesPerUserPerWindow).run();
 if(!rate.meta.changes)throw new AppError("Trop de fichiers ou de données envoyés en peu de temps. Réessayez dans une minute.",429,"file_rate_limited");
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.byteLength!==file.size)throw new AppError("La taille reçue ne correspond pas à celle annoncée.",400,"file_size_mismatch");
 const detected=detectFileType(bytes),advertised=file.type.trim().toLowerCase();
  const previewEnabled=config().FILE_PREVIEW_V1==="true",allowedTypes=previewEnabled?FILE_POLICY.uploadTypes:FILE_POLICY.legacyUploadTypes;
  if(!detected||!allowedTypes.has(detected))throw new AppError(previewEnabled?"Formats acceptés : PNG, JPEG, WebP, PDF, texte, Markdown, CSV, JSON, MP3, M4A, WAV, OGG, MP4 et WebM.":"Formats acceptés : PNG, JPEG, WebP et texte.",415,"file_type_unsupported");
 if(!declaredTypeMatches(advertised,detected))throw new AppError("Le type du fichier ne correspond pas à son contenu.",415,"file_type_mismatch");
 if(detected.startsWith("image/")&&!imageWithinPixelLimit(bytes,detected))throw new AppError(`Image invalide ou trop grande : limite de ${FILE_POLICY.maxImageSizeLabel}.`,415,"file_rejected_security");
 const digest=await sha256(bytes),duplicate=await db().prepare("SELECT * FROM files WHERE workspace_id=? AND sha256=? AND status='ready'").bind(tenant,digest).first<FileRecord>();
 if(duplicate){const resource=await getResource(tenant,duplicate.id);return Response.json(safeResourceDto(resource),{status:200,headers:{"X-File-Deduplicated":"true"}});}
 const count=await db().prepare("SELECT COUNT(*) AS total FROM resources WHERE workspace_id=? AND kind='file' AND status!='deleted'").bind(tenant).first<{total:number}>();
 if(Number(count?.total||0)>=FILE_POLICY.legacyMaxFilesPerWorkspace)throw new AppError("La limite de fichiers de cet espace est atteinte.",429,"file_quota_exceeded");
 const name=displayName(file.name),storageName=safeFilename(name),id=uid(),key=tenant+"/"+uid()+"/"+storageName;
 let text:string|undefined;if(detected==="text/plain")text=new TextDecoder("utf-8",{fatal:true}).decode(bytes).slice(0,FILE_POLICY.legacyTextPreviewChars);
 const resourceData={key,mime:detected,size:bytes.byteLength,sha256:digest,...(text===undefined?{}:{text})};
 const meterId=uid();await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:detected}});
 try{
  await db().batch([
   db().prepare("INSERT INTO resources (id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,'file',?,?, 'ready',?,?)").bind(id,tenant,name,JSON.stringify(resourceData),now,now),
   db().prepare("INSERT INTO files (id,workspace_id,owner_id,display_name,storage_name,size_bytes,detected_mime,sha256,status,storage_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'ready',?,?,?)").bind(id,tenant,user.userId,name,storageName,bytes.byteLength,detected,digest,key,now,now),
   db().prepare("INSERT INTO billing_meter VALUES (?,?,?,?,?)").bind(meterId,organization,"storage",bytes.byteLength,now),
   db().prepare("INSERT INTO file_upload_audit (id,workspace_id,actor_id,file_id,action,created_at) VALUES (?,?,?,?,'uploaded',?)").bind(uid(),tenant,user.userId,id,now),
  ]);
  return Response.json(safeResourceDto(await getResource(tenant,id)),{status:201});
 }catch(error){
  await env.BUCKET.delete(key);
  const existing=await db().prepare("SELECT id FROM files WHERE workspace_id=? AND sha256=? AND status='ready'").bind(tenant,digest).first<{id:string}>();
  if(existing){const resource=await getResource(tenant,existing.id);return Response.json(safeResourceDto(resource),{status:200,headers:{"X-File-Deduplicated":"true"}});}
  throw error;
 }
 }catch(error){return failure(error);}}

// Compatibility download route. New inline reads use the short-lived scoped URL route.
export async function GET(request:Request){try{
 const {tenant,organization}=await fileIdentity(request),id=new URL(request.url).searchParams.get("id");if(!id)throw new AppError("Fichier requis.");
 const file=await db().prepare("SELECT * FROM files WHERE id=? AND workspace_id=? AND status='ready'").bind(id,tenant).first<FileRecord>();if(!file)throw new AppError("Fichier introuvable.",404,"file_not_found");
 if(!file.storage_key)throw new AppError("Fichier introuvable.",404,"file_not_found");const object=await env.BUCKET?.get(file.storage_key);if(!object)throw new AppError("Fichier introuvable.",404,"file_not_found");
 await db().prepare("INSERT INTO billing_meter VALUES (?,?,?,?,?)").bind(uid(),organization,"transfer",object.size,Date.now()).run();
 const headers:Record<string,string>={...contentSecurityHeaders(file.detected_mime,"attachment",file.display_name)};headers["Content-Length"]=String(object.size);
 return new Response(object.body,{headers});
 }catch(error){return failure(error);}}

export async function DELETE(request:Request){try{
 const {tenant,user}=await fileIdentity(request),id=new URL(request.url).searchParams.get("id");if(!id)throw new AppError("Fichier requis.");
 const file=await db().prepare("SELECT id,status FROM files WHERE id=? AND workspace_id=?").bind(id,tenant).first<{id:string;status:string}>();if(!file)throw new AppError("Fichier introuvable.",404,"file_not_found");if(file.status==="deleted")return Response.json({deleted:true});
 const now=Date.now();await db().batch([
  db().prepare("UPDATE files SET status='deleted',deleted_at=?,updated_at=? WHERE id=? AND workspace_id=?").bind(now,now,id,tenant),
  db().prepare("UPDATE resources SET status='deleted',updated_at=? WHERE id=? AND workspace_id=? AND kind='file'").bind(now,id,tenant),
  db().prepare("INSERT INTO file_upload_audit (id,workspace_id,actor_id,file_id,action,created_at) VALUES (?,?,?,?,'soft_deleted',?)").bind(uid(),tenant,user.userId,id,now),
 ]);
 return Response.json({deleted:true});
 }catch(error){return failure(error);}}
