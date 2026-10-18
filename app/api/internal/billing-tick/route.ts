import {config,db,failure} from '@/lib/server';
import {AppError} from '@/lib/core.mjs';
import {tick,reconcileOrder} from '@/lib/billing';
import {purgeExpiredFiles,purgeExpiredUploads} from '@/lib/file-retention';
export async function POST(request:Request){try{
 const secret=config().SCHEDULER_SECRET,provided=request.headers.get('authorization');
 if(!secret||provided!=='Bearer '+secret)throw new AppError('Accès réservé au planificateur.',401);
 const now=Date.now(),events=await db().prepare("SELECT * FROM billing_events WHERE status IN ('pending','retry','processing') AND next_at<=? AND lease_until<? ORDER BY created_at LIMIT 25").bind(now,now).all<any>();
 for(const event of events.results){
  const lock=await db().prepare("UPDATE billing_events SET status='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND lease_until<? AND status!='done'").bind(now+60000,event.id,now).run();if(!lock.meta.changes)continue;
  try{
   const order=await db().prepare('SELECT id FROM billing_orders WHERE transaction_id=?').bind(event.transaction_id).first<any>();
   if(order)await reconcileOrder(order.id); // tick also verifies pending session IDs; no email-based assignment.
   await db().prepare("UPDATE billing_events SET status='done',lease_until=0 WHERE id=?").bind(event.id).run();
  }catch{await db().prepare("UPDATE billing_events SET status=?,lease_until=0,next_at=?,error='provider_reconciliation_failed' WHERE id=?").bind(event.attempts>=9?'dead':'retry',now+Math.min(3600000,30000*2**event.attempts),event.id).run();}
 }
 const billing=await tick();let fileRetention:{deleted:number;skipped?:string;failed?:boolean}={deleted:0},uploadRetention:{deleted:number;skipped?:string;failed?:boolean}={deleted:0};
 try{fileRetention=await purgeExpiredFiles(now);}catch{fileRetention={deleted:0,failed:true};}
 try{uploadRetention=await purgeExpiredUploads(now);}catch{uploadRetention={deleted:0,failed:true};}
 return Response.json({...billing,events:events.results.length,filesPurged:fileRetention.deleted,uploadsPurged:uploadRetention.deleted,fileRetentionFailed:fileRetention.failed===true,uploadRetentionFailed:uploadRetention.failed===true});
 }catch(error){return failure(error);}}
