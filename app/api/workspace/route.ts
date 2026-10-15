import {z} from "zod";
import {identity,db,list,createResource,failure,config,auditLog} from "@/lib/server";
import {falCatalog} from "@/lib/providers";
export async function GET(request:Request){try{
 const {tenant,user}=await identity(request);const workspace=await db().prepare("SELECT * FROM workspaces WHERE id=?").bind(tenant).first();
 const connection=await db().prepare("SELECT id,expires_at FROM connections WHERE workspace_id=? AND provider='meta'").bind(tenant).first();
 const cfg=config();return Response.json({user:{name:user.displayName,email:user.email},workspace,resources:await list(tenant),capabilities:{model:!!cfg.ANTHROPIC_API_KEY,modelId:cfg.ANTHROPIC_MODEL||"claude-opus-5-5",media:!!cfg.FAL_KEY&&falCatalog().length>0,metaOAuth:!!(cfg.META_APP_ID&&cfg.META_APP_SECRET&&cfg.META_GRAPH_VERSION&&cfg.TOKEN_ENCRYPTION_KEY&&cfg.META_REDIRECT_URI),metaConnected:!!connection,autonomy:false,publishing:false,browser:false,billing:false},catalog:falCatalog()});
 }catch(error){return failure(error);}}
export async function POST(request:Request){try{const {tenant}=await identity(request);const data=z.object({kind:z.enum(["project","conversation","knowledge"]),title:z.string().trim().min(1).max(160),data:z.record(z.unknown()).default({})}).parse(await request.json());const resource=await createResource(tenant,data.kind,data.title,data.data,"saved");await auditLog(tenant,"create."+data.kind,resource.id);return Response.json(resource,{status:201});}catch(error){return failure(error);}}

