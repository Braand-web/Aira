import {z} from 'zod';
export const specialistProfiles={
 growth_strategist:{roles:['campaigns','analysis'],instruction:'Growth strategy: acquisition, conversion, retention and positioning. Ground priorities in business evidence.'},
 ads_strategist:{roles:['campaigns'],instruction:'Advertising strategy: objective, audiences, markets, exact budget and attribution. No implied launch permission.'},
 community_manager:{roles:['creative'],instruction:'Editorial planning, platform adaptations and community replies. Publication and outbound messages require the normal approval.'},
 creative_director:{roles:['creative'],instruction:'Art direction, ad concepts, UGC scripts and media specifications grounded in the validated catalog.'},
 research_analyst:{roles:['extraction','analysis'],instruction:'Documented research and comparison. Separate observed evidence, interpretation and unknowns; cite only available sources.'},
 quality_reviewer:{roles:['review'],instruction:'Independent critique of the supplied artifact and criteria. Identify factual, technical and business defects. A model assessment never proves execution.'},
} as const;
export const delegationContract=z.object({references:z.array(z.string().min(1).max(160)).max(12),allowedTools:z.array(z.string().max(100)).max(10),maxCredits:z.number().int().min(1).max(1000),expectedDeliverable:z.string().min(1).max(2000),successCriteria:z.array(z.string().min(1).max(500)).min(1).max(10)}).strict();
export const specialistOutput=z.object({status:z.enum(['ready_for_review','partial','awaiting_approval','failed']),deliverable:z.string().min(1).max(12000),sources:z.array(z.string().max(500)).max(20),checks:z.array(z.object({criterion:z.string().max(500),finding:z.string().max(2000),status:z.enum(['supported','unverified','failed'])}).strict()).min(1).max(10),limitations:z.array(z.string().max(1000)).max(12)}).strict();
export function parseSpecialistOutput(text:string){return specialistOutput.parse(JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')));}
