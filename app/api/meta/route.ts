import {identity,db,failure,auditLog} from "@/lib/server";
import {metaGet} from "@/lib/providers";
import {AppError} from "@/lib/core.mjs";
import {analyticsRange,ANALYTICS_DAYS} from '@/lib/analytics.mjs';
const hasMore=(result:Record<string,unknown>)=>!!(result.paging&&typeof result.paging==='object'&&'next' in result.paging&&result.paging.next);
// Never return Graph pagination URLs (which can contain access tokens) to the browser.
const rows=(result:Record<string,unknown>)=>({data:Array.isArray(result.data)?result.data.map(value=>{const row=value&&typeof value==='object'?value as Record<string,unknown>:{};return Object.fromEntries(['campaign_id','campaign_name','spend','impressions','clicks','date_start','date_stop'].filter(key=>typeof row[key]==='string'||typeof row[key]==='number').map(key=>[key,row[key]]));}):[]});
export async function GET(request:Request){try{const {tenant}=await identity(request),url=new URL(request.url),accountId=url.searchParams.get("accountId");
 if(!accountId){const accounts=await metaGet(tenant,'me/adaccounts',{fields:'id,name,currency,account_status',limit:'100'});return Response.json({data:Array.isArray(accounts.data)?accounts.data.map(value=>{const item=value&&typeof value==='object'?value as Record<string,unknown>:{};return {id:item.id,name:item.name,currency:item.currency};}):[],hasMore:hasMore(accounts)});}
 if(!/^act_\d+$/.test(accountId))throw new AppError("Compte invalide.");
 const days=Number(url.searchParams.get('days')||30);if(!ANALYTICS_DAYS.includes(days))throw new AppError('Choisissez une période de 7, 30 ou 90 jours.');
 const rawAccount=await metaGet(tenant,accountId,{fields:'id,name,currency,timezone_name'});
 if(typeof rawAccount.currency!=='string'||!/^[A-Z]{3}$/.test(rawAccount.currency))throw new AppError('La devise du compte publicitaire est indisponible.',502);
 const account={id:accountId,name:String(rawAccount.name||accountId),currency:rawAccount.currency,timezone_name:String(rawAccount.timezone_name||'UTC')};
 const range=analyticsRange(days,account.timezone_name),fields='spend,impressions,clicks,date_start,date_stop';
 const currentRange=JSON.stringify({since:range.since,until:range.until}),previousRange=JSON.stringify({since:range.previousSince,until:range.previousUntil});
 const [current,daily,comparison]=await Promise.allSettled([
  metaGet(tenant,accountId+'/insights',{fields:'campaign_id,campaign_name,'+fields,time_range:currentRange,level:'campaign',limit:'100'}),
  metaGet(tenant,accountId+'/insights',{fields,time_range:currentRange,level:'account',time_increment:'1',limit:'100'}),
  metaGet(tenant,accountId+'/insights',{fields,time_range:previousRange,level:'account',time_increment:'1',limit:'100'})
 ]);
 if(current.status==='rejected')throw current.reason;
 const warnings=[];if(daily.status==='rejected')warnings.push('L’évolution quotidienne est indisponible.');if(comparison.status==='rejected')warnings.push('La comparaison précédente est indisponible.');
 return Response.json({account,insights:rows(current.value),daily:daily.status==='fulfilled'?rows(daily.value):null,comparison:comparison.status==='fulfilled'?rows(comparison.value):null,range,fetchedAt:new Date().toISOString(),source:'Meta',hasMore:hasMore(current.value),dailyHasMore:daily.status==='fulfilled'&&hasMore(daily.value),comparisonHasMore:comparison.status==='fulfilled'&&hasMore(comparison.value),warnings});
 }catch(error){return failure(error);}}
export async function DELETE(request:Request){try{const {tenant,user}=await identity(request,'manage');await db().prepare("DELETE FROM connections WHERE workspace_id=? AND provider='meta'").bind(tenant).run();await auditLog(tenant,user.userId,"meta.disconnected",tenant);return Response.json({disconnected:true});}catch(error){return failure(error);}}


