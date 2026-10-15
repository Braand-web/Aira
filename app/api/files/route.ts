import {env} from "cloudflare:workers";
import {identity,createResource,getResource,failure,uid,list} from "@/lib/server";
import {AppError,safeFilename} from "@/lib/core.mjs";
export async function POST(request:Request){try{
 const {tenant}=await identity(request);if(!env.BUCKET)throw new AppError("Stockage des fichiers indisponible.",503);
 const declared=Number(request.headers.get("content-length")||0);if(declared>6*1024*1024)throw new AppError("Fichier trop volumineux : 5 Mo maximum.",413);
 const data=await request.formData(),file=data.get("file");if(!(file instanceof File))throw new AppError("Fichier requis.");
 if(file.size>5*1024*1024||file.size===0)throw new AppError("Choisissez un fichier de 5 Mo maximum.",413);
 if((await list(tenant,"file")).length>=100)throw new AppError("Limite de 100 fichiers atteinte.",429);
 const bytes=new Uint8Array(await file.arrayBuffer()),decode=new TextDecoder();
 const valid={"image/png":bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,"image/jpeg":bytes[0]===255&&bytes[1]===216&&bytes[2]===255,"image/webp":decode.decode(bytes.slice(0,4))==="RIFF"&&decode.decode(bytes.slice(8,12))==="WEBP","text/plain":!bytes.includes(0),"text/markdown":!bytes.includes(0)};
 if(!valid[file.type as keyof typeof valid])throw new AppError("Formats acceptés : PNG, JPEG, WebP, texte et Markdown.");
 const key=tenant+"/"+uid()+"/"+safeFilename(file.name);await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type}});
 try{return Response.json(await createResource(tenant,"file",file.name.slice(0,160),{key,mime:file.type,size:file.size,...(file.type.startsWith("text/")?{text:decode.decode(bytes).slice(0,30000)}:{})},"ready"),{status:201});}catch(error){await env.BUCKET.delete(key);throw error;}
 }catch(error){return failure(error);}}
export async function GET(request:Request){try{const {tenant}=await identity(request),id=new URL(request.url).searchParams.get("id");if(!id)throw new AppError("Fichier requis.");const file=await getResource(tenant,id);if(file.kind!=="file")throw new AppError("Fichier introuvable.",404);const object=await env.BUCKET?.get(file.data.key);if(!object)throw new AppError("Fichier introuvable.",404);return new Response(object.body,{headers:{"Content-Type":file.data.mime,"Content-Disposition":'attachment; filename="'+safeFilename(file.title)+'"',"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"}});}catch(error){return failure(error);}}

