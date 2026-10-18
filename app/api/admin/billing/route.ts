import {identity,config,db,failure} from '@/lib/server';
import {AppError} from '@/lib/core.mjs';
import {releaseReadiness,reconcileOrder} from '@/lib/billing';
import {previewExternalRefund,confirmExternalRefund,rejectExternalRefund} from '@/lib/refunds';
import {z} from 'zod';
async function admin(request:Request){const who=await identity(request);if(!(config().BILLING_ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(who.user.userId))throw new AppError('Administration non autorisée.',403);return who;}
export async function GET(request:Request){try{await admin(request);const [orders,refunds,usage,events,settlements,creditNotes]=await Promise.all([
 db().prepare("SELECT id,organization_id,status,amount,created_at FROM billing_orders ORDER BY created_at DESC LIMIT 100").all(),
 db().prepare('SELECT * FROM billing_refunds ORDER BY created_at DESC LIMIT 100').all(),
 db().prepare('SELECT provider,role,status,SUM(cost_xaf) cost,COUNT(*) requests FROM provider_usage GROUP BY provider,role,status').all(),
 db().prepare("SELECT id,status,attempts,error FROM billing_events WHERE status!='done' LIMIT 100").all(),
 db().prepare('SELECT id,refund_id,amount,currency,environment,external_reference,created_at FROM billing_refund_settlements ORDER BY created_at DESC LIMIT 100').all(),
 db().prepare('SELECT id,organization_id,number,document,created_at FROM billing_credit_notes ORDER BY created_at DESC LIMIT 100').all()
 ]);return Response.json({readiness:releaseReadiness(),orders:orders.results,refunds:refunds.results,usage:usage.results,events:events.results,settlements:settlements.results,creditNotes:creditNotes.results,refundsTransferSupported:false},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 const who=await admin(request);
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError('Origine de la demande non autorisée.',403);
 if(Number(request.headers.get('content-length')||0)>16000)throw new AppError('Demande trop volumineuse.',413);
 const text=await request.text();if(text.length>16000)throw new AppError('Demande trop volumineuse.',413);
 const body=z.object({action:z.enum(['reconcile','refund-preview','refund-confirm-external','refund-reject'])}).passthrough().parse(JSON.parse(text));
 if(body.action==='reconcile'){const p=z.object({orderId:z.string().min(1).max(200)}).parse(body);await reconcileOrder(p.orderId);return Response.json({checked:true});}
 if(body.action==='refund-preview'){const p=z.object({refundId:z.string().uuid(),amount:z.number().int().positive()}).parse(body);return Response.json(await previewExternalRefund(who,p.refundId,p.amount));}
 if(body.action==='refund-reject'){const p=z.object({refundId:z.string().uuid(),reason:z.string().trim().min(10).max(1000)}).parse(body);return Response.json(await rejectExternalRefund(who,p.refundId,p.reason));}
 const {action,...confirmation}=body;void action;
 return Response.json(await confirmExternalRefund(who,confirmation));
 }catch(error){return failure(error);}}
