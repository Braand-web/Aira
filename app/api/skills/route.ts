import {identity,failure} from '@/lib/server';
import {reviewedSkillMetadata} from '@/lib/skills/registry';
import {reviewedSkillCatalogSchema} from '@/lib/skill-metadata';

export async function GET(request:Request){
 try{
  await identity(request);
  return Response.json(reviewedSkillCatalogSchema.parse({skills:reviewedSkillMetadata()}),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const response=failure(error);response.headers.set('Cache-Control','private, no-store');return response;}
}
