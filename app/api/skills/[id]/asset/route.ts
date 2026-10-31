import {config,failure,identity} from '@/lib/server';
import {skillPackFiles} from '@/lib/skills/registry';
import {packAssetResponse} from '@/lib/skills/pack-response.mjs';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await identity(request);
  const {id}=await params,reference=new URL(request.url).searchParams.get('reference')||'';
  return await packAssetResponse(await skillPackFiles(id),reference,config().BUCKET);
 }catch(error){const response=failure(error);response.headers.set('Cache-Control','private, no-store');return response;}
}
