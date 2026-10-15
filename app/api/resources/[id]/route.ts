import {z} from "zod";
import {identity,getResource,updateResource,failure,auditLog} from "@/lib/server";
import {AppError} from "@/lib/core.mjs";
import {pageSchema} from "@/lib/contracts";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const {tenant}=await identity(request);return Response.json(await getResource(tenant,(await context.params).id));}catch(error){return failure(error);}}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){try{
 const {tenant}=await identity(request),{id}=await context.params,resource=await getResource(tenant,id);
 const p=z.object({version:z.number().int(),action:z.enum(["rename","restore","suspend","cancel"]),title:z.string().trim().min(1).max(160).optional(),historyVersion:z.number().int().optional()}).parse(await request.json());
 let patch:any={};
 if(p.action==="rename"){if(!p.title)throw new AppError("Nom requis.");patch={title:p.title};}
 else if(p.action==="restore"){if(resource.kind!=="page")throw new AppError("Page requise.");const old=resource.data.history?.find((h:any)=>h.version===p.historyVersion);if(!old)throw new AppError("Version introuvable.");patch={data:{current:pageSchema.parse(old.page),history:[...resource.data.history,{version:resource.version,page:resource.data.current,at:Date.now()}].slice(-30)}};}
 else {if(resource.kind!=="mission")throw new AppError("Mission requise.");if(["completed","cancelled"].includes(resource.status))throw new AppError("Cette mission est terminée.",409);patch={status:p.action==="suspend"?"suspended":"cancelled"};}
 const result=await updateResource(tenant,id,p.version,patch);await auditLog(tenant,p.action,id,{version:p.version});return Response.json(result);
 }catch(error){return failure(error);}}

