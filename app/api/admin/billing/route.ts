import {identity,config,db,failure} from '@/lib/server';
import {AppError} from '@/lib/core.mjs';
import {releaseReadiness,reconcileOrder} from '@/lib/billing';
async function admin(request:Request){const who=await identity(request);if(!(config().BILLING_ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(who.user.userId))throw new AppError('Administration non autorisée.',403);return who;}
export async function GET(request:Request){try{await admin(request);const [orders,refunds,usage,events]=await Promise.all([
 db().prepare("SELECT id,organization_id,status,amount,created_at FROM billing_orders ORDER BY created_at DESC LIMIT 100").all(),
 db().prepare('SELECT * FROM billing_refunds ORDER BY created_at DESC LIMIT 100').all(),
 db().prepare('SELECT provider,role,status,SUM(cost_xaf) cost,COUNT(*) requests FROM provider_usage GROUP BY provider,role,status').all(),
 db().prepare("SELECT id,status,attempts,error FROM billing_events WHERE status!='done' LIMIT 100").all()
 ]);return Response.json({readiness:releaseReadiness(),orders:orders.results,refunds:refunds.results,usage:usage.results,events:events.results});}catch(error){return failure(error);}}
export async function POST(request:Request){try{await admin(request);const body:any=await request.json();if(body.action!=='reconcile'||typeof body.orderId!=='string')throw new AppError('Action invalide.');await reconcileOrder(body.orderId);return Response.json({checked:true});}catch(error){return failure(error);}}
