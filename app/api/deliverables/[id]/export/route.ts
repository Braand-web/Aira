import {identity,failure,db,uid} from '@/lib/server';
import {buildDocument} from '@/lib/document-delivery';
import {contentSecurityHeaders} from '@/lib/file-policy.mjs';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{
 const who=await identity(request),{id}=await context.params,params=new URL(request.url).searchParams;
 const result=await buildDocument(who.tenant,{id,version:Number(params.get('version')),format:params.get('format')});
 await db().prepare('INSERT INTO billing_meter VALUES (?,?,?,?,?)').bind(uid(),who.organization,'transfer',result.bytes.length,Date.now()).run();
 return new Response(result.bytes.slice().buffer as ArrayBuffer,{headers:{...contentSecurityHeaders(result.mime,'attachment',result.name),'Cache-Control':'private, no-store','Content-Length':String(result.bytes.length)}});
}catch(error){return failure(error);}}
