import {z} from 'zod';
import {AppError} from './core.mjs';
import {getResource,updateResource} from './server';
import {campaignBrief} from './campaign-preparation.mjs';

// A draft may be incomplete; validation here never approves advertising or tracking.
export const campaignBriefSchema=z.object({
 objective:z.string().trim().max(600),offer:z.string().trim().max(2000),audience:z.string().trim().max(2000),country:z.string().trim().max(100),currency:z.string().trim().max(10),
 dailyBudget:z.number().finite().positive().max(1_000_000_000).nullable(),destination:z.string().trim().max(2048),message:z.string().trim().max(4000),tracking:z.string().trim().max(2000),
 creativeIds:z.array(z.string().min(1).max(100)).max(12),pageId:z.string().max(100)
}).strict();

export async function reviseCampaignBrief(tenant:string,id:string,version:number,brief:unknown,title?:string){
 const resource=await getResource(tenant,id);
 if(resource.kind!=='campaign')throw new AppError('Plan de campagne requis.');
 if(resource.status!=='draft')throw new AppError('Seuls les brouillons de campagne peuvent être modifiés ici.',409);
 const parsed=campaignBriefSchema.parse(brief);parsed.creativeIds=[...new Set(parsed.creativeIds)];
 for(const relatedId of parsed.creativeIds){
  const related=await getResource(tenant,relatedId);
  if(related.kind!=='media'||related.status!=='ready')throw new AppError('La création associée n’est pas disponible pour ce plan.',409);
 }
 if(parsed.pageId){const page=await getResource(tenant,parsed.pageId);if(page.kind!=='page'||page.status==='deleted')throw new AppError('La page associée n’est pas disponible pour ce plan.',409);}
 const history=Array.isArray(resource.data.briefHistory)?resource.data.briefHistory.slice(-4):[];
 return updateResource(tenant,id,version,{...(title?{title}:{}),data:{...resource.data,...parsed,briefHistory:[...history,{version:resource.version,at:Date.now(),brief:campaignBrief(resource.data)}]}});
}
