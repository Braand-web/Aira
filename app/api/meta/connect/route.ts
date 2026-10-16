import {identity,config,db,uid,failure} from "@/lib/server";
import {AppError} from "@/lib/core.mjs";
export async function GET(request:Request){try{
 const {tenant}=await identity(request,'manage'),c=config();if(!c.META_APP_ID||!c.META_APP_SECRET||!c.META_GRAPH_VERSION||!c.META_REDIRECT_URI||!c.TOKEN_ENCRYPTION_KEY)throw new AppError("La connexion Meta doit être configurée par l’administrateur.",503,"meta_not_configured");
 const state=uid()+uid();await db().prepare("INSERT INTO oauth_states (id,workspace_id,expires_at) VALUES (?,?,?)").bind(state,tenant,Date.now()+600000).run();
 const url=new URL("https://www.facebook.com/"+c.META_GRAPH_VERSION+"/dialog/oauth");for(const [k,v] of Object.entries({client_id:c.META_APP_ID,redirect_uri:c.META_REDIRECT_URI,state,response_type:"code",scope:"ads_read,pages_show_list"}))url.searchParams.set(k,v);return Response.redirect(url.href,302);
 }catch(error){return failure(error);}}


