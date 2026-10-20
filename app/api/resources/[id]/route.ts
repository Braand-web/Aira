import {z} from "zod";
import {identity,getResource,getClientResource,updateResource,failure,auditLog,db} from "@/lib/server";
import {AppError} from "@/lib/core.mjs";
import {pageSchema} from "@/lib/contracts";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const {tenant}=await identity(request);return Response.json(await getClientResource(tenant,(await context.params).id));}catch(error){return failure(error);}}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){try{
 const {tenant,user}=await identity(request),{id}=await context.params,resource=await getResource(tenant,id);
 const p=z.object({version:z.number().int(),action:z.enum(["rename","restore","suspend","cancel"]),title:z.string().trim().min(1).max(160).optional(),historyVersion:z.number().int().optional()}).parse(await request.json());
 let patch:Parameters<typeof updateResource>[3]={};
 if(p.action==="rename"){if(!p.title)throw new AppError("Nom requis.");patch={title:p.title};}
 else if(p.action==="restore"){if(resource.kind!=="page")throw new AppError("Page requise.");const history=z.array(z.object({version:z.number().int(),page:pageSchema,at:z.number().optional()})).parse(resource.data.history??[]);const old=history.find(h=>h.version===p.historyVersion);if(!old)throw new AppError("Version introuvable.");patch={data:{current:old.page,history:[...history,{version:resource.version,page:pageSchema.parse(resource.data.current),at:Date.now()}].slice(-30)}};}
 else {if(resource.kind!=="mission")throw new AppError("Mission requise.");if(["completed","cancelled"].includes(resource.status))throw new AppError("Cette mission est terminée.",409);patch={status:p.action==="suspend"?"suspended":"cancelled"};}
 await updateResource(tenant,id,p.version,patch);if(resource.kind==="file"&&p.action==="rename"&&p.title)await db().prepare("UPDATE files SET display_name=?,updated_at=? WHERE id=? AND workspace_id=?").bind(p.title,Date.now(),id,tenant).run();await auditLog(tenant,user.userId,p.action,id,{version:p.version});return Response.json(await getClientResource(tenant,id));
 }catch(error){return failure(error);}}

