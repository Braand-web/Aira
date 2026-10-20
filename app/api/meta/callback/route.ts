import {identity,config,db,uid,seal,auditLog,failure} from "@/lib/server";
import {AppError} from "@/lib/core.mjs";
import {z} from 'zod';
export async function GET(request:Request){try{
 const {tenant,user}=await identity(request,'manage'),url=new URL(request.url),state=url.searchParams.get("state"),code=url.searchParams.get("code"),c=config();
 if(!state||!code)throw new AppError("Connexion Meta annulée ou incomplète.");
 const consumed=await db().prepare("DELETE FROM oauth_states WHERE id=? AND workspace_id=? AND expires_at>? RETURNING id").bind(state,tenant,Date.now()).first();if(!consumed)throw new AppError("Cette demande de connexion a expiré.",403);
 const response=await fetch("https://graph.facebook.com/"+c.META_GRAPH_VERSION+"/oauth/access_token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.META_APP_ID!,client_secret:c.META_APP_SECRET!,redirect_uri:c.META_REDIRECT_URI!,code}),signal:AbortSignal.timeout(20000)});
 const parsed=z.object({access_token:z.string().min(1),expires_in:z.number().positive().optional()}).safeParse(await response.json());if(!response.ok||!parsed.success)throw new AppError("Meta n’a pas confirmé la connexion.",502);const data=parsed.data;
 await db().prepare("INSERT INTO connections (id,workspace_id,provider,encrypted_token,expires_at,created_at) VALUES (?,?,'meta',?,?,?) ON CONFLICT(workspace_id,provider) DO UPDATE SET encrypted_token=excluded.encrypted_token,expires_at=excluded.expires_at").bind(uid(),tenant,await seal(data.access_token),data.expires_in?Date.now()+data.expires_in*1000:null,Date.now()).run();
 await auditLog(tenant,user.userId,"meta.connected",tenant);return Response.redirect(new URL("/?connected=meta",request.url).href,302);
 }catch(error){return failure(error);}}


