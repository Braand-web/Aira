// Isolated SQLite + real application services. No external payment/refund/email call is allowed.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const project=path.resolve(import.meta.dirname,'..');
const {build}=createRequire(path.join(project,'node_modules','package.json'))('esbuild');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync(path.join(project,'drizzle')).filter(file=>file.endsWith('.sql')).sort())sql.exec(readFileSync(path.join(project,'drizzle',file),'utf8'));
function statement(query,args=[]){return {bind(...values){return statement(query,values);},async first(column){const row=sql.prepare(query).get(...args);return column?row?.[column]??null:row??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this._run();},_run(){const result=sql.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}};}};}
const DB={prepare:query=>statement(query),async batch(statements){sql.exec('BEGIN');try{const result=statements.map(item=>item._run());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
globalThis.__productionBilling={env:{DB,BILLING_ADMIN_IDS:'finance-admin'},headers:new Headers({'x-braand-identity-id':'owner','x-braand-identity-email':'owner@test.invalid'})};
const output=path.join(project,'.local-build','production-billing-test.mjs');mkdirSync(path.dirname(output),{recursive:true});
const modules={billing:'lib/billing.ts',server:'lib/server.ts',refunds:'lib/refunds.ts',admin:'app/api/admin/billing/route.ts',route:'app/api/billing/[...path]/route.ts',notes:'lib/credit-note.ts'};
await build({stdin:{contents:Object.entries(modules).map(([name,file])=>`export * as ${name} from ${JSON.stringify(path.join(project,file).replaceAll('\\','/'))};`).join('\n'),resolveDir:project,loader:'ts'},outfile:output,bundle:true,platform:'node',format:'esm',plugins:[{name:'bindings',setup(builder){builder.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},args=>({path:args.path,namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='cloudflare:workers'?'export const env=globalThis.__productionBilling.env;':args.path==='next/headers'?'export async function headers(){return globalThis.__productionBilling.headers;}':'export function redirect(){throw new Error("unexpected redirect");}'}));}}]});
const {billing,server,refunds,admin,route,notes}=await import(pathToFileURL(output).href);
globalThis.fetch=async()=>{throw new Error('No external call is permitted by this test.');};
const owner=await server.identity(new Request('https://braand.test/api/billing/summary'));
const finance={user:{userId:'finance-admin'}};
let checks=0;
async function check(label,fn){await fn();checks++;console.log('PASS '+label);}
function seed(kind='topup',environment='sandbox'){
 const id=crypto.randomUUID(),now=Date.now(),amount=kind==='subscription'?99000:5000;
 const product=kind==='subscription'?{kind,plan:'pro',cycle:'annual',credits:200,amount,currency:'XAF'}:{kind,credits:100,amount,currency:'XAF'};
 sql.prepare('INSERT INTO billing_quotes VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner.organization,'owner',JSON.stringify(product),amount,'fixture','[]',now,now+900000);
 sql.prepare("INSERT INTO billing_orders(id,organization_id,quote_id,actor,idempotency_key,status,amount,product,created_at,updated_at,payment_environment) VALUES (?,?,?,?,?,'fulfilled',?,?,?,?,?)").run(id,owner.organization,id,'owner',id,amount,JSON.stringify(product),now,now,environment);
 sql.prepare('INSERT INTO billing_invoices VALUES (?,?,?,?,?,?)').run('invoice:'+id,owner.organization,id,'AIR-'+id,JSON.stringify({total:amount,tax:0,taxBps:0,currency:'XAF'}),now);
 sql.prepare("INSERT INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,created_at) VALUES (?,?,?, ?,10000,10000,?,?)").run('lot:'+id,owner.organization,kind,id,now,now);
 if(kind==='subscription')sql.prepare("INSERT INTO billing_subscriptions(id,organization_id,plan,cycle,start_at,end_at,order_id) VALUES (?,?,'pro','annual',?,?,?)").run('sub:'+id,owner.organization,now,now+366*86400000,id);
 return {id,amount};
}
const body=(quote,reference='external-fixture-'+crypto.randomUUID())=>({quoteId:quote.id,amount:quote.amount,currency:quote.currency,environment:quote.environment,externalReference:reference,evidenceNote:'Sandbox fixture evidence inspected manually.',acknowledgement:'EXTERNAL_REFUND_CONFIRMED'});
const order=seed();let refund,partial;
await check('Owner refund request is idempotent and freezes only that purchase',async()=>{
 refund=await billing.requestRefund(owner,order.id,'Please examine this test purchase refund.');
 assert.equal((await billing.requestRefund(owner,order.id,'The same refund requested twice.')).id,refund.id);
 assert.equal(sql.prepare('SELECT frozen FROM credit_lots WHERE source_id=?').get(order.id).frozen,1);
 await assert.rejects(()=>billing.requestRefund({...owner,organization:'another-org'},order.id,'Cross tenant refund is forbidden.'));
});
await check('Only configured finance admin can preview/confirm; XAF rejects fractional amounts',async()=>{
 await assert.rejects(()=>refunds.previewExternalRefund(owner,refund.id,2500));
 await assert.rejects(()=>refunds.previewExternalRefund(finance,refund.id,1.5));
 await assert.rejects(()=>refunds.previewExternalRefund(finance,refund.id,-1));
 partial=await refunds.previewExternalRefund(finance,refund.id,2500);assert.equal(partial.plan.revokedCredits,50);assert.equal(partial.executesMoneyTransfer,false);
});
await check('Partial external confirmation atomically compensates credits, creates credit note, preserves residual rights',async()=>{
 const input=body(partial);await Promise.all([refunds.confirmExternalRefund(finance,input),refunds.confirmExternalRefund(finance,input)]);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_refund_settlements').get().n,1);
 assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(order.id).status,'partially_refunded');
 assert.equal(sql.prepare('SELECT balance FROM credit_lots WHERE source_id=?').get(order.id).balance,5000);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_credit_notes').get().n,1);
 assert.equal(sql.prepare("SELECT SUM(units) n FROM credit_ledger WHERE kind='refund'").get().n,5000);
 assert.throws(()=>sql.prepare('UPDATE billing_credit_notes SET number=?').run('rewritten'),/immutable_credit_note/);
 await assert.rejects(()=>refunds.previewExternalRefund(finance,refund.id,2501));
 await billing.reconcileOrder(order.id);assert.equal(sql.prepare('SELECT balance FROM credit_lots WHERE source_id=?').get(order.id).balance,5000);
});
await check('Changed credits or live reservations invalidate exact refund preview without any partial mutation',async()=>{
 const quote=await refunds.previewExternalRefund(finance,refund.id,500),hold=await billing.reserve(owner,'refund-reservation',1000);
 // Other lots do not yet exist, so this reservation necessarily references the purchased lot.
 await assert.rejects(()=>refunds.confirmExternalRefund(finance,body(quote)),/changé|changed|actualisez|utilise/);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_refund_settlements').get().n,1);
 await billing.settleHold(hold.id,1000);
 await assert.rejects(()=>refunds.confirmExternalRefund(finance,body(quote)));
});
await check('Final remainder after consumption never creates a negative wallet and cannot be replayed',async()=>{
 const quote=await refunds.previewExternalRefund(finance,refund.id,2500);assert.equal(quote.plan.revokedCredits,40);assert.equal(quote.plan.consumedCredits,10);
 const input=body(quote);await refunds.confirmExternalRefund(finance,input);await refunds.confirmExternalRefund(finance,input);
 assert.equal(sql.prepare('SELECT balance FROM credit_lots WHERE source_id=?').get(order.id).balance,0);
 assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(order.id).status,'refunded');
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_credit_notes').get().n,2);
 assert.equal(sql.prepare('SELECT SUM(amount) total FROM billing_refund_settlements').get().total,5000);
 assert.throws(()=>sql.prepare('DELETE FROM billing_refund_settlements').run(),/immutable_refund/);
});
await check('Full annual refund cancels purchased subscription and prevents future allocations',async()=>{
 const annual=seed('subscription'),r=await billing.requestRefund(owner,annual.id,'Cancel unused annual fixture subscription.');
 const quote=await refunds.previewExternalRefund(finance,r.id,annual.amount);assert.equal(quote.plan.cancelSubscription,true);
 await refunds.confirmExternalRefund(finance,body(quote));
 assert.equal(sql.prepare('SELECT status FROM billing_subscriptions WHERE order_id=?').get(annual.id).status,'cancelled');
 await billing.allocateDue(owner.organization,Date.now()+360*86400000);
 assert.equal(sql.prepare('SELECT SUM(balance) balance FROM credit_lots WHERE source_id=?').get(annual.id).balance,0);
});
await check('Rejected request unfreezes credits with audited reason; confirmed refund cannot be rejected',async()=>{
 const purchase=seed(),r=await billing.requestRefund(owner,purchase.id,'Request to decline in the test fixture.');
 await refunds.rejectExternalRefund(finance,r.id,'Purchase delivered, reviewed fixture decision.');
 assert.equal(sql.prepare('SELECT frozen FROM credit_lots WHERE source_id=?').get(purchase.id).frozen,0);
 assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(purchase.id).status,'fulfilled');
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM billing_audit WHERE action='refund.rejected'").get().n,1);
 const reopened=await billing.requestRefund(owner,purchase.id,'Customer submits a new explanation after rejection.');assert.equal(reopened.id,r.id);
 await refunds.rejectExternalRefund(finance,reopened.id,'Second reviewed decision preserves its own audit record.');
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM billing_audit WHERE action='refund.rejected'").get().n,2);
 await assert.rejects(()=>refunds.rejectExternalRefund(finance,refund.id,'Cannot reject an already confirmed refund.'));
});
await check('Unknown legacy environment and mismatched external environment fail closed',async()=>{
 const legacy=seed('topup',null),r=await billing.requestRefund(owner,legacy.id,'Legacy environment is not known at migration.');
 await assert.rejects(()=>refunds.previewExternalRefund(finance,r.id,500));
 const another=seed(),r2=await billing.requestRefund(owner,another.id,'Known sandbox purchase for mismatch test.');
 const quote=await refunds.previewExternalRefund(finance,r2.id,500);
 await assert.rejects(()=>refunds.confirmExternalRefund(finance,{...body(quote),environment:'live'}));
 assert.equal(sql.prepare('SELECT balance FROM credit_lots WHERE source_id=?').get(another.id).balance,10000);
});
await check('Admin HTTP route requires same-origin explicit confirmation and exposes immutable credit notes',async()=>{
 globalThis.__productionBilling.headers=new Headers({'x-braand-identity-id':'finance-admin','x-braand-identity-email':'finance@test.invalid'});
 const make=(origin,action)=>new Request('https://braand.test/api/admin/billing',{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(action)});
 assert.equal((await admin.POST(make(undefined,{action:'refund-preview',refundId:refund.id,amount:1}))).status,403);
 assert.equal((await admin.POST(make('https://evil.test',{action:'refund-preview',refundId:refund.id,amount:1}))).status,403);
 const get=await admin.GET(new Request('https://braand.test/api/admin/billing'));assert.equal(get.status,200);
 const data=await get.json();assert.equal(data.refundsTransferSupported,false);assert.equal(data.creditNotes.length,3);
 assert.equal((await admin.POST(make('https://braand.test',{action:'refund-confirm-external',quoteId:partial.id}))).status,400);
});
await check('Customer credit note downloads are scoped to the paying organization and escape embedded text',async()=>{
 const note=sql.prepare('SELECT id FROM billing_credit_notes LIMIT 1').get();
 const get=()=>route.GET(new Request('https://braand.test/api/billing/credit-notes/'+encodeURIComponent(note.id)),{params:Promise.resolve({path:['credit-notes',note.id]})});
 globalThis.__productionBilling.headers=new Headers({'x-braand-identity-id':'owner','x-braand-identity-email':'owner@test.invalid'});
 const result=await get();assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.match(await result.text(),/Avoir Braand/);
 globalThis.__productionBilling.headers=new Headers({'x-braand-identity-id':'outsider','x-braand-identity-email':'outsider@test.invalid'});assert.equal((await get()).status,404);
 const html=notes.creditNoteHTML('<script>',{invoiceNumber:'<img src=x>',total:2500,currency:'XAF',confirmedAt:Date.now(),environment:'sandbox',externalReference:'external-fixture',originalInvoice:{seller:{name:'<script>alert(1)</script>'}}});
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/DOCUMENT DE TEST/);
});
await check('Verified hosted checkout grants XAF and provider-converted USD once; unrelated or inconsistent payments never grant',async()=>{
 Object.assign(globalThis.__productionBilling.env,{SASPAY_SECRET_KEY:'sk_test_fixture_only',SASPAY_MERCHANT_ID:'merchant-fixture',SASPAY_ENV:'sandbox',BILLING_LEGAL_JSON:JSON.stringify({name:'Test fixture',address:'Adresse fictive Douala',taxId:'TEST-NIU-000',email:'seller@example.test'}),BILLING_TAX_VALIDATED:'true',BILLING_TAX_JSON:JSON.stringify({mode:'exclusive',rateBps:0,jurisdiction:'fixture:CM-test-rule',version:'fixture-tax-v1',validatedAt:'2026-10-22'})});
 const sessions=new Map(),transactions=new Map(),paths=[];
 globalThis.fetch=async(url,init)=>{
  assert.notEqual(init?.method,'POST');const u=new URL(url);assert.equal(u.origin,'https://api.saspay.me');paths.push(u.pathname);
  const segments=u.pathname.split('/').filter(Boolean),id=decodeURIComponent(segments.at(-1)==='verify'?segments.at(-2):segments.at(-1));
  const value=sessions.get(id)||transactions.get(id);assert.ok(value,'Only documented mocked routes may be read.');return Response.json(value);
 };
 async function pending(status='SUCCESS'){
  const id=crypto.randomUUID(),now=Date.now(),organization='payment:'+id;sql.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run(organization,'Payment fixture','owner',now);
  const quote=await billing.makeQuote({...owner,organization},{kind:'topup',quantity:50}),product=sql.prepare('SELECT product FROM billing_quotes WHERE id=?').get(quote.id).product;
  sql.prepare("INSERT INTO billing_orders(id,organization_id,quote_id,actor,idempotency_key,status,amount,product,session_id,created_at,updated_at,payment_environment) VALUES (?,?,?,?,?,'pending',?,?,?, ?,?,'sandbox')").run(id,organization,quote.id,'owner',id,2500,product,'session:'+id,now,now);
  const session={id:'session:'+id,merchant:'merchant-fixture',metadata:{braand_order_id:id},currency:'XAF',amount:'2500.00',status:'PAID',transaction:'transaction:'+id};
  const tx={id:'transaction:'+id,merchant:'merchant-fixture',transaction_type:'PAIEMENT',flow_direction:'INBOUND',currency:'XAF',requested_amount:'2500.00',debited_amount:'2500.00',net_amount:'2400.00',client_fee:'100.00',fee_charge_mode:'DEDUCTED',status};
  sessions.set(session.id,session);transactions.set(tx.id,tx);return {id,session,tx};
 }
 const good=await pending();await billing.reconcileOrder(good.id);await billing.reconcileOrder(good.id);
 assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(good.id).status,'fulfilled');assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(good.id).n,1);
 assert.ok(paths.some(route=>route==='/api/v1/payments/'+encodeURIComponent(good.tx.id)+'/verify/'));
 const failed=await pending('FAILED');await billing.reconcileOrder(failed.id);assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(failed.id).status,'failed');assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(failed.id).n,0);
 failed.tx.status='SUCCESS';await billing.reconcileOrder(failed.id);assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(failed.id).status,'fulfilled');
 const abandoned=await pending();abandoned.session.status='CANCELLED';abandoned.session.transaction=null;await billing.reconcileOrder(abandoned.id);assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(abandoned.id).status,'cancelled');assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(abandoned.id).n,0);
 const usd=await pending();Object.assign(usd.tx,{currency:'USD',requested_amount:'4.50',debited_amount:'4.50',net_amount:'4.30',client_fee:'0.20'});
 await Promise.all([billing.reconcileOrder(usd.id),billing.reconcileOrder(usd.id)]);await billing.reconcileOrder(usd.id);
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(usd.id).n,1);
 assert.equal(sql.prepare('SELECT granted FROM credit_lots WHERE source_id=?').get(usd.id).granted,5000);
 const verified=JSON.parse(sql.prepare('SELECT verified FROM billing_orders WHERE id=?').get(usd.id).verified);
 assert.equal(verified.session,usd.session.id);assert.equal(verified.transaction.currency,'USD');assert.equal(verified.transaction.charged,'4.50');
 const invoice=JSON.parse(sql.prepare('SELECT document FROM billing_invoices WHERE order_id=?').get(usd.id).document);assert.equal(invoice.currency,'XAF');assert.equal(invoice.total,2500);
 for(const currency of ['XOF','CDF','GHS','GNF','KES','MWK','MZN','NGN','RWF','TZS','UGX','ZMW']){
  const local=await pending();Object.assign(local.tx,{currency,requested_amount:'100.00',debited_amount:'100.00'});await billing.reconcileOrder(local.id);
  assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(local.id).status,'fulfilled');
  assert.equal(JSON.parse(sql.prepare('SELECT verified FROM billing_orders WHERE id=?').get(local.id).verified).transaction.currency,currency);
 }
 for(const mutate of [
  payment=>{payment.session.id='unrelated-session';},payment=>{payment.session.metadata.braand_order_id='unrelated-order';},
  payment=>{payment.session.merchant='wrong-merchant';},payment=>{payment.session.amount='1.00';},payment=>{payment.session.currency='USD';},
  payment=>{payment.tx.id='unrelated-transaction';},payment=>{payment.tx.merchant='wrong-merchant';},
  payment=>{payment.tx.requested_amount='0.00';payment.tx.debited_amount='0.00';},payment=>{payment.tx.debited_amount='4.49';},
  payment=>{payment.tx.requested_amount='4.501';},payment=>{delete payment.tx.requested_amount;},
  payment=>{payment.tx.fee_charge_mode='ADD_ON';},payment=>{payment.tx.currency='EUR';},
 ]){
  const invalid=await pending();Object.assign(invalid.tx,{currency:'USD',requested_amount:'4.50',debited_amount:'4.50'});mutate(invalid);
  await assert.rejects(()=>billing.reconcileOrder(invalid.id));
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(invalid.id).n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_invoices WHERE order_id=?').get(invalid.id).n,0);
 }
 const otherMerchant=await pending();otherMerchant.tx.merchant='wrong-merchant';await assert.rejects(()=>billing.reconcileOrder(otherMerchant.id));assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(otherMerchant.id).n,0);
 for(const mutate of [payment=>{payment.tx.merchant=17;},payment=>{payment.tx.requested_amount={value:2500};},payment=>{payment.session.transaction={id:17};}]){
  const malformed=await pending();mutate(malformed);await assert.rejects(()=>billing.reconcileOrder(malformed.id));
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(malformed.id).n,0);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_invoices WHERE order_id=?').get(malformed.id).n,0);
  assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(malformed.id).status,'pending');
 }
});
await check('Two partial refunds conserve the exact original invoice tax and replay never duplicates the correction',async()=>{
 // The immutable real invoice is inserted once for this dedicated test order.
 const id=crypto.randomUUID(),now=Date.now(),amount=5843,product={kind:'topup',quantity:100,credits:100,amount,currency:'XAF',version:'fixture-tax'};
 sql.prepare('INSERT INTO billing_quotes VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner.organization,'owner',JSON.stringify(product),amount,'fixture','[]',now,now+900000);
 sql.prepare("INSERT INTO billing_orders(id,organization_id,quote_id,actor,idempotency_key,status,amount,product,created_at,updated_at,payment_environment) VALUES (?,?,?,?,?,'fulfilled',?,?,?,?,'sandbox')").run(id,owner.organization,id,'owner',id,amount,JSON.stringify(product),now,now);
 sql.prepare('INSERT INTO billing_invoices VALUES (?,?,?,?,?,?)').run('tax-invoice:'+id,owner.organization,id,'AIR-TAX-'+id,JSON.stringify({total:5843,subtotal:4900,tax:943,taxBps:1925,currency:'XAF'}),now);
 sql.prepare("INSERT INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,created_at) VALUES (?,?, 'topup',?,10000,10000,?,?)").run('tax-lot:'+id,owner.organization,id,now,now);
 const refund=await billing.requestRefund(owner,id,'Test cumulative taxes for two partial refunds.'),first=await refunds.previewExternalRefund(finance,refund.id,2921),firstBody=body(first);
 assert.equal(first.plan.tax,471);await refunds.confirmExternalRefund(finance,firstBody);await refunds.confirmExternalRefund(finance,firstBody);
 const final=await refunds.previewExternalRefund(finance,refund.id,2922);assert.equal(final.plan.tax,472);await refunds.confirmExternalRefund(finance,body(final));
 const result=sql.prepare('SELECT SUM(t.tax) tax,SUM(t.subtotal) subtotal,COUNT(*) count FROM billing_credit_note_taxes t JOIN billing_credit_notes n ON n.id=t.credit_note_id WHERE n.invoice_id=?').get('tax-invoice:'+id);assert.deepEqual({...result},{tax:943,subtotal:4900,count:2});
 const note=sql.prepare('SELECT n.id,n.document,t.tax,t.subtotal FROM billing_credit_notes n JOIN billing_credit_note_taxes t ON t.credit_note_id=n.id WHERE n.invoice_id=? ORDER BY t.tax').get('tax-invoice:'+id);assert.match(notes.creditNoteHTML('TEST',{...JSON.parse(note.document),tax:note.tax,subtotal:note.subtotal}),/471 FCFA/);assert.throws(()=>sql.prepare('UPDATE billing_credit_note_taxes SET tax=0 WHERE credit_note_id=?').run(note.id),/immutable_credit_note_tax/);
 const previousHeaders=globalThis.__productionBilling.headers;try{globalThis.__productionBilling.headers=new Headers({'x-braand-identity-id':'owner','x-braand-identity-email':'owner@test.invalid'});const response=await route.GET(new Request('https://braand.test/api/billing/credit-notes/'+note.id),{params:Promise.resolve({path:['credit-notes',note.id]})});assert.equal(response.status,200);assert.match(await response.text(),/471 FCFA/);}finally{globalThis.__productionBilling.headers=previousHeaders;}
});
console.log(`${checks} production billing checks passed. No external request, payment or refund was made.`);sql.close();
