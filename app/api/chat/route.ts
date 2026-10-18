import {requireModel} from "@/lib/llm";
import {z} from "zod";
import {identity,db,uid,getResource,createResource,failure} from "@/lib/server";
import {runAgent} from "@/lib/agent";
import {AppError} from "@/lib/core.mjs";
import {startRunBudget,finishRunBudget,type RunBudget} from '@/lib/metering';
import {FILE_POLICY,safeFileDto} from '@/lib/file-policy.mjs';
import type {FileRecord} from '@/lib/contracts';
export async function POST(request:Request){
 let tenant="",conversationId="",locked=false,budget:RunBudget|undefined;
 try{
  const who=await identity(request);tenant=who.tenant;
  requireModel();
  const body=z.object({text:z.string().trim().min(1).max(16000),conversationId:z.string().optional(),attachments:z.array(z.string()).max(FILE_POLICY.maxFilesPerMessage).default([]),maxCredits:z.number().int().min(1).max(1000)}).parse(await request.json());
  const conversation=body.conversationId?await getResource(tenant,body.conversationId):await createResource(tenant,"conversation",body.text.slice(0,70),{},"saved");if(conversation.kind!=="conversation")throw new AppError("Discussion invalide.");conversationId=conversation.id;
  const lock=await db().prepare("UPDATE resources SET status='streaming',updated_at=? WHERE id=? AND workspace_id=? AND (status!='streaming' OR updated_at<?)").bind(Date.now(),conversationId,tenant,Date.now()-300000).run();if(!lock.meta.changes)throw new AppError("Une réponse est déjà en cours dans cette discussion.",409);
  locked=true;
  const content:any[]=[{type:"text",text:body.text}];
  for(const id of body.attachments){const file=await getResource(tenant,id);if(file.kind!=="file")throw new AppError("Pièce jointe invalide.");const fileRow=await db().prepare("SELECT status FROM files WHERE id=? AND workspace_id=?").bind(id,tenant).first<{status:string}>();if(!fileRow||fileRow.status!=="ready")throw new AppError("Cette pièce jointe n’est pas encore disponible.",409,"file_not_ready");if(file.data.mime?.startsWith("image/")){const object=await (await import("cloudflare:workers")).env.BUCKET?.get(file.data.key);if(object&&object.size<FILE_POLICY.legacyDirectUploadBytes){const bytes=new Uint8Array(await object.arrayBuffer());let s="";for(let i=0;i<bytes.length;i+=FILE_POLICY.base64EncodingChunkBytes)s+=String.fromCharCode(...bytes.subarray(i,i+FILE_POLICY.base64EncodingChunkBytes));content.push({type:"image",source:{type:"base64",media_type:file.data.mime,data:btoa(s)}});}}else if(file.data.text)content.push({type:"text",text:"Pièce jointe non fiable : "+file.title+"\n"+file.data.text});}
  const runId=uid(),now=Date.now();
  budget=await startRunBudget(who,runId,body.maxCredits);
  await db().batch([db().prepare("INSERT INTO messages (id,workspace_id,conversation_id,role,content,attachments,created_at) VALUES (?,?,?,'user',?,?,?)").bind(uid(),tenant,conversationId,JSON.stringify(content),JSON.stringify(body.attachments),now),db().prepare("INSERT INTO runs (id,workspace_id,conversation_id,status,created_at,updated_at) VALUES (?,?,?,'streaming',?,?)").bind(runId,tenant,conversationId,now,now)]);
  const encoder=new TextEncoder(),abort=new AbortController();let clientClosed=false,lastHeartbeat=Date.now();
  const stream=new ReadableStream({
   async start(controller){
    const emit=async(type:string,data:unknown)=>{if(Date.now()-lastHeartbeat>30000){lastHeartbeat=Date.now();await db().prepare("UPDATE runs SET updated_at=? WHERE id=? AND status='streaming'").bind(lastHeartbeat,runId).run();}const saved=await db().prepare("INSERT INTO events (run_id,type,data,created_at) VALUES (?,?,?,?)").bind(runId,type,JSON.stringify(data),Date.now()).run();if(!clientClosed)controller.enqueue(encoder.encode("id: "+saved.meta.last_row_id+"\nevent: "+type+"\ndata: "+JSON.stringify(data)+"\n\n"));};
    try{await emit("run",{runId,conversationId});await runAgent(tenant,conversationId,runId,emit,abort.signal,budget!);await db().prepare("UPDATE runs SET status='completed',updated_at=? WHERE id=?").bind(Date.now(),runId).run();await emit("done",{runId});}
    catch(error){const message=error instanceof AppError?error.message:"Le flux a été interrompu. Les étapes terminées restent enregistrées.";await db().prepare("UPDATE runs SET status=CASE WHEN status='cancelled' THEN status WHEN ? IN ('budget_exhausted','step_limit') THEN 'partial' ELSE 'failed' END,error=?,updated_at=? WHERE id=?").bind(error instanceof AppError?error.code:"technical_failure",message,Date.now(),runId).run();if(!clientClosed)await emit("error",{message});}
    finally{try{await finishRunBudget(budget!);}finally{await db().prepare("UPDATE resources SET status='saved',updated_at=? WHERE id=? AND workspace_id=?").bind(Date.now(),conversationId,tenant).run();if(!clientClosed)controller.close();}}
   },cancel(){clientClosed=true;abort.abort();}
  });
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"}});
 }catch(error){if(budget)await finishRunBudget(budget);if(locked)await db().prepare("UPDATE resources SET status='saved' WHERE id=? AND workspace_id=?").bind(conversationId,tenant).run();return failure(error);}
}
export async function GET(request:Request){try{
 const {tenant}=await identity(request),url=new URL(request.url),runId=url.searchParams.get("runId"),conversationId=url.searchParams.get("conversationId");
 if(runId){const run=await db().prepare("SELECT * FROM runs WHERE id=? AND workspace_id=?").bind(runId,tenant).first();if(!run)throw new AppError("Réponse introuvable.",404);const cursor=Math.max(0,Number(url.searchParams.get("after"))||0);const events=await db().prepare("SELECT seq,type,data FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT 2000").bind(runId,cursor).all();return Response.json({run,events:events.results.map((r:any)=>({...r,data:JSON.parse(r.data)}))});}
 if(!conversationId)throw new AppError("Discussion requise.");await getResource(tenant,conversationId);
 type StoredMessage={id:string;role:string;content:string;attachments:string;created_at:number};
 type MessageBlock={type:string;text?:string};
 const rows=await db().prepare("SELECT id,role,content,attachments,created_at FROM messages WHERE workspace_id=? AND conversation_id=? ORDER BY created_at").bind(tenant,conversationId).all<StoredMessage>();
 const messages=await Promise.all(rows.results.map(async m=>{let ids:string[]=[];try{const value=JSON.parse(m.attachments||"[]") as unknown;if(Array.isArray(value))ids=value.filter((id):id is string=>typeof id==="string");}catch{}const attachments=await Promise.all(ids.map(async id=>{const file=await db().prepare("SELECT * FROM files WHERE id=? AND workspace_id=?").bind(id,tenant).first<FileRecord>();return file?safeFileDto(file):{id,workspaceId:tenant,name:"Fichier indisponible",size:0,mime:"application/octet-stream",status:"unavailable",createdAt:0,updatedAt:0,deletedAt:null};}));const storedContent=JSON.parse(m.content) as MessageBlock[];return {...m,attachments,content:storedContent.filter(block=>block.type==="text"||block.type==="image").map(block=>block.type==="image"?{type:"text",text:"[Image jointe]"}:block)};}));
 return Response.json({messages:messages.filter(m=>m.content.length||m.attachments.length)});
 }catch(error){return failure(error);}}
export async function DELETE(request:Request){try{const {tenant}=await identity(request);const {runId}=z.object({runId:z.string()}).parse(await request.json());await db().prepare("UPDATE runs SET status='cancelled',updated_at=? WHERE id=? AND workspace_id=? AND status='streaming'").bind(Date.now(),runId,tenant).run();return Response.json({stopped:true});}catch(error){return failure(error);}}


