// Runs real services and routes against an isolated SQLite database. No external calls.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const project=path.resolve(import.meta.dirname,'..'),runtime=process.env.AIRA_TOOLCHAIN||path.join(project,'node_modules');
const {build}=createRequire(path.join(runtime,'package.json'))('esbuild');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of readdirSync(path.join(project,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(path.join(project,'drizzle',f),'utf8'));
function statement(query,args=[]){return {bind(...v){return statement(query,v);},async first(column){const r=sql.prepare(query).get(...args);return column?r?.[column]??null:r??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this._run();},_run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}};}
const DB={prepare:q=>statement(q),async batch(ss){sql.exec('BEGIN');try{const rows=ss.map(s=>s._run());sql.exec('COMMIT');return rows;}catch(e){sql.exec('ROLLBACK');throw e;}}};
globalThis.__billingTest={env:{DB},headers:new Headers({'x-aira-identity-id':'owner','x-aira-identity-email':'owner@test.invalid'})};
const out=path.join(project,'.local-build','billing-test.mjs');mkdirSync(path.dirname(out),{recursive:true});
const modules={billing:'lib/billing.ts',server:'lib/server.ts',organizations:'lib/organizations.ts',workspace:'app/api/workspace/route.ts',refunds:'lib/refunds.ts',route:'app/api/billing/[...path]/route.ts',webhook:'app/api/webhooks/saspay/route.ts',tick:'app/api/internal/billing-tick/route.ts',admin:'app/api/admin/billing/route.ts',meter:'lib/metering.ts'};
await build({stdin:{contents:Object.entries(modules).map(([n,f])=>'export * as '+n+' from "'+path.join(project,f).replaceAll('\\','/')+'";').join('\n'),resolveDir:project,loader:'ts'},outfile:out,bundle:true,platform:'node',format:'esm',nodePaths:[runtime],plugins:[{name:'test-bindings',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__billingTest.env;':a.path==='next/headers'?'export async function headers(){return globalThis.__billingTest.headers;}':'export function redirect(){throw new Error("unexpected redirect");}'}));}}]});
const {billing:b,server:s,organizations:o,workspace,refunds,route,webhook,tick,admin,meter}=await import(pathToFileURL(out).href),env=globalThis.__billingTest.env;
let checks=0;const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{checks++;console.log('PASS '+name);});
const request=(method='GET',body,space='owner')=>new Request('https://aira.test/api/billing/summary',{method,headers:{'Content-Type':'application/json','x-aira-workspace':space},...(body?{body:JSON.stringify(body)}:{})});
const who=await s.identity(request());
await check('Launch gates default closed, free quota defaults zero',async()=>{assert.equal(b.releaseReadiness().enabled,false);await assert.rejects(()=>b.claimFree(who));});
await check('Anonymous catalogue is public; private summary requires identity',async()=>{const old=globalThis.__billingTest.headers;globalThis.__billingTest.headers=new Headers();assert.equal((await route.GET(request(),{params:Promise.resolve({path:['catalog']})})).status,200);assert.equal((await route.GET(request(),{params:Promise.resolve({path:['summary']})})).status,401);globalThis.__billingTest.headers=old;});
await check('Free allocation is one-time and globally capped',async()=>{env.FREE_DAILY_CREDITS='10';await b.claimFree(who);await b.claimFree(who);assert.equal((await b.summary('owner')).wallet.available,10);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_claims').get().n,1);});
await check('Reservations reject concurrent overspend and duplicate reference is idempotent',async()=>{const h=await b.reserve(who,'reservation-test',800);assert.equal((await b.reserve(who,'reservation-test',800)).id,h.id);await assert.rejects(()=>b.reserve(who,'overspend',300));await b.settleHold(h.id,500);await b.settleHold(h.id,900);assert.equal((await b.summary('owner')).wallet.available,5);});
const economics={taxBps:0,feeBps:500,feeFixed:100,unitCost:4,monthlyServiceCost:300,riskBps:100};
const taxRule={mode:'exclusive',rateBps:0,jurisdiction:'fixture:CM-test-rule',version:'fixture-tax-v1',validatedAt:'2026-10-22'};
Object.assign(env,{SASPAY_SECRET_KEY:'sk_test_fixture',SASPAY_MERCHANT_ID:'merchant-fixture',SASPAY_WEBHOOK_SECRET:'fixture-only',SASPAY_ENV:'sandbox',BILLING_LEGAL_JSON:'{"name":"Test fixture","address":"Adresse fictive Douala","taxId":"TEST-NIU-000","email":"seller@example.test"}',BILLING_TAX_JSON:JSON.stringify(taxRule),BILLING_ECONOMICS_JSON:JSON.stringify({essential:economics,pro:economics,business:economics}),SCHEDULER_SECRET:'scheduler-fixture'});
for(const k of ['XAF_CHECKOUT_VALIDATED','TAX_VALIDATED','BENCHMARKS_VALIDATED','SCHEDULER_VERIFIED','PROVIDER_TESTS_PASSED','SUPPORT_READY','TERMS_APPROVED','RESTORE_TESTED','WEBHOOK_VERIFIED','PRODUCT_ACCEPTANCE','ENABLED'])env['BILLING_'+k]='true';
const sessions=new Map(),transactions=new Map();let creates=0,timeout=false;
await check('Incomplete or invalid seller identity cannot enable checkout or quote a payable product',async()=>{
 const configured=env.BILLING_LEGAL_JSON;
 try{for(const value of ['{INVALID','{}','{"name":"Seller"}']){env.BILLING_LEGAL_JSON=value;assert.equal(b.releaseReadiness().checks.fiscal,false);assert.equal(b.releaseReadiness().enabled,false);await assert.rejects(()=>b.makeQuote(who,{kind:'topup',quantity:50}),error=>error.code==='billing_legal_not_ready');}}finally{env.BILLING_LEGAL_JSON=configured;}
});
globalThis.fetch=async(url,init)=>{
 const u=new URL(url);assert.equal(u.hostname,'api.saspay.me');
 if(init?.method==='POST'){
  creates++;const body=JSON.parse(init.body),id='session-'+creates,txid='transaction-'+creates;
  const session={...body,id,merchant:env.SASPAY_MERCHANT_ID,checkout_url:'https://pay.saspay.me/checkout/'+id,status:'PAID',transaction:txid};
  sessions.set(id,session);transactions.set(txid,{id:txid,merchant:env.SASPAY_MERCHANT_ID,status:'SUCCESS',transaction_type:'PAIEMENT',flow_direction:'INBOUND',currency:'XAF',requested_amount:body.amount,debited_amount:body.amount,fee_charge_mode:'DEDUCTED'});
  if(timeout)throw new Error('simulated timeout after accepted create');return Response.json({data:session});
 }
 if(u.pathname==='/api/v1/checkout-sessions/')return Response.json({results:[...sessions.values()],next:null});
 const segments=u.pathname.split('/').filter(Boolean),id=segments.at(-1)==='verify'?segments.at(-2):segments.at(-1);return Response.json({data:sessions.get(id)||transactions.get(id)});
};
async function legacySubscriptionPurchase(person){
 const id=crypto.randomUUID(),now=Date.now(),p={kind:'subscription',plan:'pro',cycle:'annual',credits:200,amount:99000,currency:'XAF',version:'2026-10-16.1'},sessionId='legacy-session-'+id,txid='legacy-transaction-'+id;
 sql.prepare('INSERT INTO billing_quotes VALUES (?,?,?,?,?,?,?,?,?)').run(id,person.organization,person.user.userId,JSON.stringify(p),p.amount,p.version,await b.subscriptionVersion(person.organization),now,now+900000);
 sql.prepare("INSERT INTO billing_orders(id,organization_id,quote_id,actor,idempotency_key,status,amount,product,session_id,created_at,updated_at,payment_environment) VALUES (?,?,?,?,?,'pending',?,?,?,?,?,'sandbox')").run(id,person.organization,id,person.user.userId,id,p.amount,JSON.stringify(p),sessionId,now,now);
 sessions.set(sessionId,{id:sessionId,merchant:env.SASPAY_MERCHANT_ID,metadata:{aira_order_id:id},currency:'XAF',amount:'99000.00',transaction:txid});
 transactions.set(txid,{id:txid,merchant:env.SASPAY_MERCHANT_ID,status:'SUCCESS',transaction_type:'PAIEMENT',flow_direction:'INBOUND',currency:'XAF',requested_amount:'99000.00',debited_amount:'99000.00',fee_charge_mode:'DEDUCTED'});
 await b.reconcileOrder(id);return {id};
}
let order;
await check('Unknown tax rules block quoting, and new annual/custom sales are refused',async()=>{
 const configured=env.BILLING_TAX_JSON;delete env.BILLING_TAX_JSON;assert.equal(b.releaseReadiness().checks.fiscal,false);await assert.rejects(()=>b.makeQuote(who,{kind:'topup',quantity:50}),error=>error.code==='tax_not_ready');env.BILLING_TAX_JSON=configured;
 await assert.rejects(()=>b.makeQuote(who,{kind:'subscription',plan:'pro',cycle:'annual'}),error=>error.code==='annual_unavailable');await assert.rejects(()=>b.makeQuote(who,{kind:'topup',quantity:150}));
});
await check('Tax-inclusive total and complete tax config are immutable before provider execution',async()=>{
 const changed={...taxRule,rateBps:1925};env.BILLING_TAX_JSON=JSON.stringify(changed);env.BILLING_ECONOMICS_JSON=JSON.stringify({essential:{...economics,taxBps:1925},pro:{...economics,taxBps:1925},business:{...economics,taxBps:1925}});
 const tampered=await route.POST(request('POST',{kind:'subscription',plan:'essential',cycle:'period',amount:1,subtotal:1,tax:0,total:1,taxRateBps:0}),{params:Promise.resolve({path:['quotes']})});assert.equal(tampered.status,201);const safe=await tampered.json();assert.deepEqual([safe.subtotal,safe.tax,safe.total],[4900,943,5843]);
 const quote=await b.makeQuote(who,{kind:'subscription',plan:'essential',cycle:'period'});assert.deepEqual([quote.subtotal,quote.tax,quote.total,quote.amount],[4900,943,5843,5843]);const before=creates;
 env.BILLING_TAX_JSON=JSON.stringify(taxRule);await assert.rejects(()=>b.checkout(who,quote.id,crypto.randomUUID(),'https://aira.test'),error=>error.code==='quote_tax_changed');assert.equal(creates,before);
 env.BILLING_TAX_JSON=JSON.stringify(changed);const corrupt=JSON.parse(sql.prepare('SELECT product FROM billing_quotes WHERE id=?').get(quote.id).product);corrupt.tax=0;sql.prepare('UPDATE billing_quotes SET product=? WHERE id=?').run(JSON.stringify(corrupt),quote.id);await assert.rejects(()=>b.checkout(who,quote.id,crypto.randomUUID(),'https://aira.test'),error=>error.code==='quote_tax_changed');assert.equal(creates,before);
 env.BILLING_TAX_JSON=JSON.stringify(taxRule);env.BILLING_ECONOMICS_JSON=JSON.stringify({essential:economics,pro:economics,business:economics});
});
await check('Checkout uses immutable server amount; double click creates one session',async()=>{const q=await b.makeQuote(who,{kind:'topup',quantity:125});assert.equal(q.amount,5000);const key=crypto.randomUUID();order=await b.checkout(who,q.id,key,'https://aira.test');await b.checkout(who,q.id,key,'https://aira.test');assert.equal(creates,1);assert.equal((await b.summary('owner')).wallet.available,5);});
await check('Repeated and concurrent confirmations grant purchased credits once and identify the system reconciler',async()=>{await Promise.all([b.reconcileOrder(order.id),b.reconcileOrder(order.id)]);await b.reconcileOrder(order.id);assert.equal((await b.summary('owner')).wallet.available,130);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_invoices').get().n,1);const actors=sql.prepare("SELECT actor FROM audit WHERE action='billing.fulfilled' AND target=?").all(order.id);assert(actors.length>0);assert(actors.every(row=>row.actor==='system:billing-reconciliation'));});
await check('Wrong currency cannot grant credits',async()=>{const q=await b.makeQuote(who,{kind:'topup',quantity:50});const pending=await b.checkout(who,q.id,crypto.randomUUID(),'https://aira.test');const row=sql.prepare('SELECT session_id FROM billing_orders WHERE id=?').get(pending.id);sessions.get(row.session_id).currency='USD';await assert.rejects(()=>b.reconcileOrder(pending.id));assert.equal((await b.summary('owner')).wallet.available,130);sessions.get(row.session_id).currency='XAF';await b.reconcileOrder(pending.id);});
await check('Uncertain checkout creation is recovered without another charge request',async()=>{timeout=true;const q=await b.makeQuote(who,{kind:'topup',quantity:50});await assert.rejects(()=>b.checkout(who,q.id,crypto.randomUUID(),'https://aira.test'));const row=sql.prepare('SELECT id FROM billing_orders WHERE quote_id=?').get(q.id),before=creates;timeout=false;await b.reconcileOrder(row.id);assert.equal(creates,before);assert.equal((await b.summary('owner')).wallet.available,230);});
let annualId;
await check('Existing annual purchase retains 200 credits per month; catch-up grants exactly twelve',async()=>{const result=await legacySubscriptionPurchase(who);annualId='sub:'+result.id;assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE source='subscription'").get().n,1);const sub=await b.currentSubscription('owner');await b.allocateDue('owner',sub.end_at-1);await b.allocateDue('owner',sub.end_at-1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE source='subscription'").get().n,12);assert.equal(sql.prepare("SELECT SUM(granted) n FROM credit_lots WHERE source_id=?").get(result.id).n,240000);assert.equal((await b.summary('owner')).creditAllowance,200);});
await check('Cross-organization access and reader mutations are denied',async()=>{await assert.rejects(()=>s.authorize('owner','intruder','read'));sql.prepare("INSERT INTO organization_members VALUES ('owner','reader','reader',1,NULL)").run();sql.prepare("INSERT INTO members VALUES ('reader-membership','owner','reader','reader')").run();await assert.rejects(()=>s.authorize('owner','reader','read'));sql.prepare("UPDATE billing_subscriptions SET plan='business',catalog_plan='business' WHERE id=?").run(annualId);assert.equal((await s.authorize('owner','reader','read')).role,'reader');await assert.rejects(()=>s.authorize('owner','reader','write'));await assert.rejects(()=>b.makeQuote({...who,role:'reader'},{kind:'topup',quantity:50}));});
await check('Refund request freezes purchased lot and cannot regrant payment',async()=>{await b.requestRefund(who,order.id,'Duplicate purchase, please review.');await b.reconcileOrder(order.id);assert.equal(sql.prepare('SELECT frozen FROM credit_lots WHERE source_id=?').get(order.id).frozen,1);assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(order.id).status,'refund_requested');});
await check('Webhook replay is durable, deduplicated, and never directly grants credits',async()=>{const body=JSON.stringify({event:'transaction.success',data:{id:'transaction-unrelated'}}),stamp=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',env.SASPAY_WEBHOOK_SECRET).update(stamp+'.'+body).digest('hex');const make=()=>new Request('https://aira.test/api/webhooks/saspay',{method:'POST',headers:{'x-webhook-timestamp':stamp,'x-webhook-signature':sig},body});assert.equal((await webhook.POST(make())).status,200);assert.equal((await webhook.POST(make())).status,200);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_events').get().n,1);assert.equal((await webhook.POST(new Request('https://aira.test/api/webhooks/saspay',{method:'POST',body}))).status,401);});
await check('Scheduler and admin routes deny untrusted access',async()=>{assert.equal((await tick.POST(request('POST',{}))).status,503);assert.equal((await admin.GET(request())).status,403);});
await check('Unverified and invalid model rates block paid model calls',async()=>{assert.throws(()=>meter.modelRate());env.ANTHROPIC_RATE_JSON=JSON.stringify({model:'claude-opus-5-5',input:5,output:25,cacheWrite:6.25,cacheRead:.5,usdXaf:600,overheadXaf:1,verifiedAt:'not-a-date'});assert.throws(()=>meter.modelRate());});
await check('Expired reserved credits settle once; released remainder expires without becoming topup',async()=>{
 const now=Date.now();sql.prepare('INSERT INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('expires-lot','expiry-org','subscription','sub',1000,1000,now-1000,now+10000,now);
 const h=await b.reserve({...who,organization:'expiry-org'},'expiry-test',800);sql.prepare("UPDATE credit_lots SET expires_at=? WHERE id='expires-lot'").run(now-1);await b.expireLots('expiry-org');assert.equal(sql.prepare("SELECT balance FROM credit_lots WHERE id='expires-lot'").get().balance,800);await b.settleHold(h.id,500);await b.settleHold(h.id,500);assert.equal(sql.prepare("SELECT balance FROM credit_lots WHERE id='expires-lot'").get().balance,0);assert.equal(sql.prepare("SELECT SUM(units) n FROM credit_ledger WHERE organization_id='expiry-org' AND kind='expire'").get().n,500);
});
await check('Actual upgrade keeps end date and prepayment does not grant another current quota',async()=>{
 globalThis.__billingTest.headers=new Headers({'x-aira-identity-id':'upgrade-owner','x-aira-identity-email':'upgrade@test.invalid'});const person=await s.identity(request('GET',undefined,'upgrade-owner'));
 await legacySubscriptionPurchase(person);
 const before=await b.currentSubscription(person.organization),upgrade=await b.makeQuote(person,{kind:'upgrade'}),payment=await b.checkout(person,upgrade.id,crypto.randomUUID(),'https://aira.test');await Promise.all([b.reconcileOrder(payment.id),b.reconcileOrder(payment.id)]);
 const after=await b.currentSubscription(person.organization);assert.equal(after.end_at,before.end_at);assert.equal(after.plan,'business');assert.equal(after.version,2);assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE organization_id=? AND source='upgrade'").get(person.organization).n,1);
 const wallet=(await b.summary(person.organization)).wallet.available;
 const next=await b.makeQuote(person,{kind:'subscription',plan:'pro',cycle:'period'}),renew=await b.checkout(person,next.id,crypto.randomUUID(),'https://aira.test');await b.reconcileOrder(renew.id);assert.equal((await b.summary(person.organization)).wallet.available,wallet);assert.equal(sql.prepare('SELECT start_at FROM billing_subscriptions WHERE order_id=?').get(renew.id).start_at,before.end_at);
});
await check('Stale subscription quote is rejected before another provider request',async()=>{
 const person=await s.identity(request('GET',undefined,'upgrade-owner')),quote=await b.makeQuote(person,{kind:'topup',quantity:125}),before=creates;
 sql.prepare('UPDATE billing_subscriptions SET version=version+1 WHERE organization_id=?').run(person.organization);await assert.rejects(()=>b.checkout(person,quote.id,crypto.randomUUID(),'https://aira.test'));assert.equal(creates,before);
});
await check('Late upgrade payment is held for reconciliation without expired benefits',async()=>{
 globalThis.__billingTest.headers=new Headers({'x-aira-identity-id':'late-owner','x-aira-identity-email':'late@test.invalid'});const person=await s.identity(request('GET',undefined,'late-owner'));
 const order=await legacySubscriptionPurchase(person);
 const change=await b.makeQuote(person,{kind:'upgrade'}),payment=await b.checkout(person,change.id,crypto.randomUUID(),'https://aira.test'),original=Date.now;
 try{Date.now=()=>change.periodEnd+1000;await b.reconcileOrder(payment.id);}finally{Date.now=original;}
 assert.equal(sql.prepare('SELECT plan FROM billing_subscriptions WHERE order_id=?').get(order.id).plan,'pro');assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(payment.id).status,'needs_reconciliation');assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE source_id=?").get(payment.id).n,0);
});
await check('Essential tax total reaches the provider and its immutable receipt survives later tax changes',async()=>{
 const previousHeaders=globalThis.__billingTest.headers;globalThis.__billingTest.headers=new Headers({'x-aira-identity-id':'essential-owner','x-aira-identity-email':'essential@test.invalid'});
 try{
  const person=await s.identity(request('GET',undefined,'essential-owner')),changed={...taxRule,rateBps:1925};env.BILLING_TAX_JSON=JSON.stringify(changed);env.BILLING_ECONOMICS_JSON=JSON.stringify({essential:{...economics,taxBps:1925},pro:economics,business:economics});
  const quote=await b.makeQuote(person,{kind:'subscription',plan:'essential',cycle:'period'}),payment=await b.checkout(person,quote.id,crypto.randomUUID(),'https://aira.test'),row=sql.prepare('SELECT session_id FROM billing_orders WHERE id=?').get(payment.id);assert.equal(sessions.get(row.session_id).amount,'5843.00');
  env.BILLING_TAX_JSON=JSON.stringify(taxRule);env.BILLING_ECONOMICS_JSON=JSON.stringify({essential:economics,pro:economics,business:economics});await b.reconcileOrder(payment.id);
  const summary=await b.summary(person.organization);assert.equal(summary.subscription.plan,'essential');assert.equal(summary.creditAllowance,100);assert.equal(summary.wallet.available,100);assert.equal((await b.activeRights(person.organization)).plan,'essential');
  const invoice=JSON.parse(sql.prepare('SELECT document FROM billing_invoices WHERE order_id=?').get(payment.id).document);assert.deepEqual([invoice.subtotal,invoice.tax,invoice.total,invoice.taxBps],[4900,943,5843,1925]);
  const blocked=await b.makeQuote(person,{kind:'upgrade',plan:'pro'});assert.equal(blocked.eligible,false);await assert.rejects(()=>b.checkout(person,blocked.id,crypto.randomUUID(),'https://aira.test'),error=>error.code==='margin_gate');
  // A second explicit fixture scenario proves the positive path; the margin guard stays intact.
  env.BILLING_ECONOMICS_JSON=JSON.stringify({essential:economics,pro:{...economics,feeBps:400,feeFixed:50},business:economics});
  const next=await b.makeQuote(person,{kind:'upgrade',plan:'pro'}),upgrade=await b.checkout(person,next.id,crypto.randomUUID(),'https://aira.test');await b.reconcileOrder(upgrade.id);const upgraded=await b.currentSubscription(person.organization);assert.equal(upgraded.plan,'pro');assert.equal((await b.summary(person.organization)).creditAllowance,250);assert.equal((await b.subscriptionTerms(upgraded)).periodPrice,9900);
  const business=await b.makeQuote(person,{kind:'upgrade',plan:'business'});assert(business.amount>14900&&business.amount<=15000);assert(business.units>34900&&business.units<=35000);
 }finally{globalThis.__billingTest.headers=previousHeaders;env.BILLING_TAX_JSON=JSON.stringify(taxRule);env.BILLING_ECONOMICS_JSON=JSON.stringify({essential:economics,pro:economics,business:economics});}
});
await check('A pending legacy custom topup retains its original quantity and price without being re-sold',async()=>{
 const id=crypto.randomUUID(),now=Date.now(),p={kind:'topup',quantity:150,credits:150,amount:7250,currency:'XAF',version:'2026-10-16.1'},sessionId='legacy-custom-session',txid='legacy-custom-transaction';
 sql.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run('legacy-topup-org','Legacy','legacy-owner',now);
 sql.prepare('INSERT INTO billing_quotes VALUES (?,?,?,?,?,?,?,?,?)').run(id,'legacy-topup-org','legacy-owner',JSON.stringify(p),p.amount,p.version,'[]',now,now+900000);
 sql.prepare("INSERT INTO billing_orders(id,organization_id,quote_id,actor,idempotency_key,status,amount,product,session_id,created_at,updated_at,payment_environment) VALUES (?,?,?,?,?,'pending',?,?,?,?,?,'sandbox')").run(id,'legacy-topup-org',id,'legacy-owner',id,p.amount,JSON.stringify(p),sessionId,now,now);
 sessions.set(sessionId,{id:sessionId,merchant:env.SASPAY_MERCHANT_ID,metadata:{aira_order_id:id},currency:'XAF',amount:'7250.00',transaction:txid});transactions.set(txid,{id:txid,merchant:env.SASPAY_MERCHANT_ID,status:'SUCCESS',transaction_type:'PAIEMENT',flow_direction:'INBOUND',currency:'XAF',requested_amount:'7250.00',debited_amount:'7250.00',fee_charge_mode:'DEDUCTED'});
 await b.reconcileOrder(id);await b.reconcileOrder(id);assert.equal((await b.summary('legacy-topup-org')).wallet.available,150);assert.equal(sql.prepare('SELECT amount FROM billing_orders WHERE id=?').get(id).amount,7250);assert.equal(sql.prepare('SELECT COUNT(*) n FROM credit_lots WHERE source_id=?').get(id).n,1);
});
await check('Partial deliveries are charged, technical failure without a delivery is released',async()=>{
 const rate={model:'fixture-model',verifiedAt:'2026-10-22',input:5,output:25,cacheWrite:6.25,cacheRead:.5,usdXaf:600,overheadXaf:1},usage={input_tokens:1000,output_tokens:100};
 for(const [status,delivery,expected] of [['partial',false,138],['failed',false,0],['failed',true,138]]){
  const id=crypto.randomUUID(),now=Date.now(),hold=await b.reserve(who,'chat:'+id,1000);
  sql.prepare("INSERT INTO resources(id,workspace_id,kind,title,created_at,updated_at) VALUES (?,?,'conversation','Test',?,?)").run(id,who.tenant,now,now);
  sql.prepare('INSERT INTO runs(id,workspace_id,conversation_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,who.tenant,id,status,now,now);
  sql.prepare("INSERT INTO provider_usage(id,organization_id,workspace_id,run_id,hold_id,provider,role,rate,usage,cost_xaf,status,created_at) VALUES (?,?,?,?,?,'anthropic','master',?,?,5.5,'complete',?)").run(id,who.organization,who.tenant,id,hold.id,JSON.stringify(rate),JSON.stringify(usage),now);
  if(delivery)sql.prepare('INSERT INTO events(run_id,type,data,created_at) VALUES (?,?,?,?)').run(id,'tool_result',JSON.stringify({result:{id:'page',kind:'page'}}),now);
  await meter.finishRunBudget({who,runId:id,holdId:hold.id,limit:1000,rate});assert.equal(sql.prepare('SELECT actual FROM credit_holds WHERE id=?').get(hold.id).actual,expected);
 }
});
await check('Project and storage quotas reject writes atomically',async()=>{
 const now=Date.now();sql.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run('quota','Quota','q',now);sql.prepare('INSERT INTO workspaces(id,name,created_at,organization_id) VALUES (?,?,?,?)').run('quota-space','Space',now,'quota');
 const add=sql.prepare("INSERT INTO resources(id,workspace_id,kind,title,created_at,updated_at) VALUES (?,'quota-space','project','Project',?,?)");add.run('p1',now,now);add.run('p2',now,now);assert.throws(()=>add.run('p3',now,now),/project_quota/);
 const write=sql.prepare('INSERT INTO billing_meter VALUES (?,?,?,?,?)');write.run('storage1','quota','storage',200*1024**2,now);assert.throws(()=>write.run('storage2','quota','storage',100*1024**2,now),/storage_quota/);
});
await check('Old unresolved checkouts do not starve a later confirmed payment',async()=>{
 const now=Date.now(),p={kind:'topup',quantity:50,credits:50,amount:2500,currency:'XAF',version:'2026-10-16.1'};
 for(let i=0;i<26;i++){
  const id='fair-'+i,org='fair-org-'+i;sql.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run(org,'Fairness','owner',now);
  sql.prepare('INSERT INTO billing_quotes VALUES (?,?,?,?,?,?,?,?,?)').run(id,org,'owner',JSON.stringify(p),2500,p.version,'[]',now,now+900000);
  sql.prepare('INSERT INTO billing_orders(id,organization_id,quote_id,actor,idempotency_key,status,amount,product,session_id,created_at,updated_at,payment_environment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,org,id,'owner',id,'needs_reconciliation',2500,JSON.stringify(p),i===25?'fair-session':null,now-120000+i,now-120000+i,'sandbox');
 }
 sessions.set('fair-session',{id:'fair-session',merchant:env.SASPAY_MERCHANT_ID,metadata:{aira_order_id:'fair-25'},currency:'XAF',amount:'2500.00',transaction:'fair-transaction'});transactions.set('fair-transaction',{id:'fair-transaction',merchant:env.SASPAY_MERCHANT_ID,status:'SUCCESS',transaction_type:'PAIEMENT',flow_direction:'INBOUND',currency:'XAF',requested_amount:'2500.00',debited_amount:'2500.00',fee_charge_mode:'DEDUCTED'});
 await b.tick();assert.notEqual(sql.prepare("SELECT status FROM billing_orders WHERE id='fair-25'").get().status,'fulfilled');await b.tick();assert.equal(sql.prepare("SELECT status FROM billing_orders WHERE id='fair-25'").get().status,'fulfilled');
});
await check('Shared workspace audit records the actual administrator, never the workspace as actor',async()=>{
 const oldHeaders=globalThis.__billingTest.headers;
 try{
  sql.prepare("INSERT INTO organization_members(organization_id,user_id,role,active) VALUES ('owner','audit-admin','admin',1),('owner','audit-target','editor',1)").run();
  sql.prepare("INSERT INTO members(id,workspace_id,user_id,role) VALUES ('audit-membership','owner','audit-admin','admin')").run();
  globalThis.__billingTest.headers=new Headers({'x-aira-identity-id':'audit-admin','x-aira-identity-email':'audit-admin@test.invalid'});
  const adminIdentity=await s.identity(request('POST',{}),'manage');
  await o.changeOrganization(adminIdentity,{action:'revoke',userId:'audit-target'});
  const entry=sql.prepare("SELECT actor,workspace_id FROM audit WHERE action='member.revoked' AND target='audit-target'").get();
  assert.equal(entry.actor,'audit-admin');assert.equal(entry.workspace_id,'owner');
  const before=sql.prepare('SELECT COUNT(*) n FROM audit').get().n;
  await assert.rejects(()=>s.auditLog('owner','','invalid','target'),error=>error.code==='audit_actor_missing');
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM audit').get().n,before);
 }finally{globalThis.__billingTest.headers=oldHeaders;}
});
await check('Workspace response keeps financial documents private from administrators',async()=>{
 const oldHeaders=globalThis.__billingTest.headers;
 try{
  env.BILLING_ADMIN_IDS='fixture-finance';const finance={user:{userId:'fixture-finance'}};
  const requested=sql.prepare("SELECT id FROM billing_refunds WHERE organization_id='owner' AND status='requested' LIMIT 1").get();assert.ok(requested);
  const preview=await refunds.previewExternalRefund(finance,requested.id,100);
  await refunds.confirmExternalRefund(finance,{quoteId:preview.id,amount:preview.amount,currency:preview.currency,environment:preview.environment,externalReference:'fixture-privacy-refund',evidenceNote:'Offline sandbox fixture evidence for financial document privacy.',acknowledgement:'EXTERNAL_REFUND_CONFIRMED'});
  assert.ok((await b.summary('owner')).creditNotes.length>0);
  globalThis.__billingTest.headers=new Headers({'x-aira-identity-id':'audit-admin','x-aira-identity-email':'audit-admin@test.invalid'});
  const response=await workspace.GET(request());assert.equal(response.status,200);const data=await response.json();
  assert.deepEqual(data.billing.orders,[]);assert.deepEqual(data.billing.invoices,[]);assert.deepEqual(data.billing.creditNotes,[]);
 }finally{globalThis.__billingTest.headers=oldHeaders;}
});
console.log(`${checks} billing integration checks passed. Provider responses were simulated; no real payment or provider validation.`);sql.close();


