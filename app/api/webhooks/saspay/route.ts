import {db,config,failure} from '@/lib/server';
import {verifyWebhook} from '@/lib/billing-core.mjs';
import {AppError} from '@/lib/core.mjs';
export async function POST(request:Request){try{
 if(Number(request.headers.get('content-length')||0)>65536)throw new AppError('Événement trop volumineux.',413);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>65536)throw new AppError('Événement trop volumineux.',413);
 if(!await verifyWebhook(raw,request.headers,config().SASPAY_WEBHOOK_SECRET))throw new AppError('Signature invalide.',401);
 const body=JSON.parse(raw);if(!body.event||typeof body.event!=='string')throw new AppError('Événement invalide.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');
 await db().prepare('INSERT OR IGNORE INTO billing_events(id,event_type,transaction_id,body,next_at,created_at) VALUES (?,?,?,?,?,?)').bind(hash,body.event,body.data?.id||null,raw,Date.now(),Date.now()).run();
 return Response.json({received:true});
 }catch(error){return failure(error);}}
