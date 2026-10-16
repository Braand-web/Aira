import {identity,db,failure,auditLog} from "@/lib/server";
import {metaGet} from "@/lib/providers";
import {AppError} from "@/lib/core.mjs";
export async function GET(request:Request){try{const {tenant}=await identity(request),accountId=new URL(request.url).searchParams.get("accountId");
 if(!accountId)return Response.json(await metaGet(tenant,"me/adaccounts",{fields:"id,name,currency,account_status"}));
 if(!/^act_\d+$/.test(accountId))throw new AppError("Compte invalide.");
 const [account,insights]=await Promise.all([metaGet(tenant,accountId,{fields:"id,name,currency,timezone_name"}),metaGet(tenant,accountId+"/insights",{fields:"campaign_name,spend,impressions,clicks,actions,action_values,date_start,date_stop",date_preset:"last_30d",level:"campaign",limit:"100"})]);
 return Response.json({account,insights,fetchedAt:new Date().toISOString(),source:"Meta",period:"last_30d",hasMore:!!insights.paging?.next});
 }catch(error){return failure(error);}}
export async function DELETE(request:Request){try{const {tenant}=await identity(request,'manage');await db().prepare("DELETE FROM connections WHERE workspace_id=? AND provider='meta'").bind(tenant).run();await auditLog(tenant,"meta.disconnected",tenant);return Response.json({disconnected:true});}catch(error){return failure(error);}}


