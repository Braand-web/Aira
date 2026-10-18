import {z} from 'zod';
import {db,config,uid} from './server';
import {AppError} from './core.mjs';

type RefundActor={user:{userId:string}};
type RefundRow={id:string;organization_id:string;order_id:string;status:string;version:number;amount:number};
type OrderRow={id:string;amount:number;currency:string;payment_environment:'sandbox'|'live'|null;product:string};
type LotRow={id:string;granted:number;balance:number;reserved:number;frozen:number};
type RefundPlan={lots:(LotRow&{revoke:number})[];refundTotal:number;orderAmount:number;cancelSubscription:boolean;revokedCredits:number;consumedCredits:number;policy:string};
const s=(query:string,...values:(string|number|null)[])=>db().prepare(query).bind(...values);

export function requireRefundAdmin(who:RefundActor){
 const ids=(config().BILLING_ADMIN_IDS||'').split(',').map(id=>id.trim()).filter(Boolean);
 if(!ids.includes(who.user.userId))throw new AppError('Administration non autorisée.',403);
}

/** This is an evidence recording workflow. It never calls a payout or refund provider. */
export async function previewExternalRefund(who:RefundActor,refundId:string,amount:number){
 requireRefundAdmin(who);
 if(!Number.isSafeInteger(amount)||amount<=0)throw new AppError('Le remboursement doit être un montant entier positif en XAF.');
 const refund=await s('SELECT * FROM billing_refunds WHERE id=?',refundId).first<RefundRow>();
 if(!refund||!['requested','partially_confirmed'].includes(refund.status))throw new AppError('Demande de remboursement indisponible.',409);
 const order=await s('SELECT * FROM billing_orders WHERE id=?',refund.order_id).first<OrderRow>();
 if(!order||!order.payment_environment||order.currency!=='XAF')throw new AppError('Environnement ou monnaie historique non vérifiés : rapprochement manuel requis.',409);
 const invoice=await s('SELECT id FROM billing_invoices WHERE order_id=?',order.id).first<{id:string}>();
 if(!invoice)throw new AppError('La facture d’origine est nécessaire avant de produire un avoir.',409);
 const product=JSON.parse(order.product) as {kind:string};
 if(product.kind==='upgrade')throw new AppError('Le remboursement d’un changement de formule nécessite une décision manuelle sur les droits associés.',409);
 const upgrade=await s("SELECT id FROM billing_orders WHERE status='fulfilled' AND json_extract(product,'$.subscriptionId') IN (SELECT id FROM billing_subscriptions WHERE order_id=?)",order.id).first();
 if(upgrade)throw new AppError('Un changement de formule dépend de cet achat : rapprochez les deux commandes avant de rembourser.',409);
 const previous=await s('SELECT COALESCE(SUM(amount),0) amount FROM billing_refund_settlements WHERE refund_id=?',refund.id).first<{amount:number}>();
 const total=(previous?.amount||0)+amount;
 if(total>order.amount)throw new AppError('Le cumul dépasserait le montant payé.',409);
 const rows=await s('SELECT id,granted,balance,reserved,frozen FROM credit_lots WHERE organization_id=? AND source_id=? ORDER BY id',refund.organization_id,order.id).all<LotRow>();
 if(rows.results.some(lot=>lot.reserved>0))throw new AppError('Une opération utilise encore ces crédits. Rapprochez-la avant de confirmer un remboursement.',409);
 const alreadyRevoked=await s("SELECT COALESCE(SUM(l.units),0) units FROM credit_ledger l JOIN billing_refund_settlements r ON r.id=l.reference WHERE r.refund_id=? AND l.kind='refund'",refund.id).first<{units:number}>();
 const granted=rows.results.reduce((sum,lot)=>sum+lot.granted,0),available=rows.results.reduce((sum,lot)=>sum+lot.balance,0);
 const full=total===order.amount;
 // The preview explicitly discloses any consumed/expired credit concession. Never creates a negative wallet.
 const target=full?Math.max(0,granted-(alreadyRevoked?.units||0)):Math.max(0,Math.ceil(granted*total/order.amount)-(alreadyRevoked?.units||0));
 let left=Math.min(target,available);
 const lots=rows.results.map(lot=>{const revoke=Math.min(lot.balance,left);left-=revoke;return {...lot,revoke};});
 const plan:RefundPlan={lots,refundTotal:total,orderAmount:order.amount,cancelSubscription:full&&product.kind==='subscription',revokedCredits:Math.min(target,available)/100,consumedCredits:Math.max(0,target-available)/100,policy:'Partial: remove proportional issued credits still available, preserve subscription dates. Full: remove remaining credits and cancel the purchased subscription. Any consumed/expired-credit concession requires this exact administrator confirmation.'};
 const id=uid(),now=Date.now();
 await s('INSERT INTO billing_refund_quotes(id,refund_id,organization_id,actor,amount,expected_version,plan,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)',id,refund.id,refund.organization_id,who.user.userId,amount,refund.version,JSON.stringify(plan),now+900000,now).run();
 return {id,refundId,amount,currency:'XAF',environment:order.payment_environment,expiresAt:now+900000,plan,executesMoneyTransfer:false};
}

const confirmationSchema=z.object({quoteId:z.string().uuid(),externalReference:z.string().trim().min(4).max(160).regex(/^[a-zA-Z0-9._:/-]+$/),evidenceNote:z.string().trim().min(10).max(1000),amount:z.number().int().positive(),currency:z.literal('XAF'),environment:z.enum(['sandbox','live']),acknowledgement:z.literal('EXTERNAL_REFUND_CONFIRMED')}).strict();
export async function confirmExternalRefund(who:RefundActor,input:unknown){
 requireRefundAdmin(who);const body=confirmationSchema.parse(input);
 const prior=await s('SELECT * FROM billing_refund_settlements WHERE quote_id=?',body.quoteId).first<{id:string;external_reference:string;amount:number;environment:string}>();
 if(prior){if(prior.external_reference!==body.externalReference||prior.amount!==body.amount||prior.environment!==body.environment)throw new AppError('Cette confirmation correspond à un autre rapprochement.',409);return {id:prior.id,status:'recorded',executesMoneyTransfer:false};}
 const quote=await s('SELECT * FROM billing_refund_quotes WHERE id=? AND actor=?',body.quoteId,who.user.userId).first<{refund_id:string;organization_id:string;amount:number;expires_at:number}>();
 if(!quote||quote.expires_at<=Date.now()||quote.amount!==body.amount)throw new AppError('Le récapitulatif a changé ou expiré. Recréez-le avant confirmation.',409);
 const id=uid();
 try{await s('INSERT INTO billing_refund_settlements(id,quote_id,refund_id,organization_id,actor,amount,currency,environment,external_reference,evidence_note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',id,body.quoteId,quote.refund_id,quote.organization_id,who.user.userId,body.amount,body.currency,body.environment,body.externalReference,body.evidenceNote,Date.now()).run();}
 catch(error){
  const duplicate=await s('SELECT id FROM billing_refund_settlements WHERE quote_id=? AND external_reference=?',body.quoteId,body.externalReference).first<{id:string}>();
  if(duplicate)return {id:duplicate.id,status:'recorded',executesMoneyTransfer:false};
  if(String(error).includes('refund')||String(error).includes('UNIQUE'))throw new AppError('Les crédits, la demande ou la référence ont changé. Aucun nouveau remboursement enregistré ; actualisez le récapitulatif.',409);
  throw error;
 }
 return {id,status:'recorded',executesMoneyTransfer:false};
}

export async function rejectExternalRefund(who:RefundActor,refundId:string,reason:string){
 requireRefundAdmin(who);
 if(reason.trim().length<10||reason.length>1000)throw new AppError('Précisez le motif de la décision.');
 const refund=await s("SELECT * FROM billing_refunds WHERE id=? AND status='requested'",refundId).first<RefundRow>();
 if(!refund)throw new AppError('Une demande déjà rapprochée ne peut pas être rejetée.',409);
 const now=Date.now();
 await db().batch([
  s("UPDATE billing_refunds SET status='rejected',version=version+1 WHERE id=? AND status='requested' AND version=?",refund.id,refund.version),
  s("UPDATE credit_lots SET frozen=0 WHERE source_id=? AND organization_id=? AND EXISTS(SELECT 1 FROM billing_refunds WHERE id=? AND status='rejected' AND version=?)",refund.order_id,refund.organization_id,refund.id,refund.version+1),
  s("UPDATE billing_orders SET status='fulfilled',updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM billing_refunds WHERE id=? AND status='rejected' AND version=?)",now,refund.order_id,refund.id,refund.version+1),
  s("INSERT OR IGNORE INTO billing_audit SELECT ?,?,?, 'refund.rejected',id,?,? FROM billing_refunds WHERE id=? AND status='rejected' AND version=?",'refund-rejected:'+refund.id+':'+(refund.version+1),who.user.userId,refund.organization_id,JSON.stringify({reason}),now,refund.id,refund.version+1)
 ]);
 return {id:refundId,status:'rejected',executesMoneyTransfer:false};
}
