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
globalThis.__billingTest={env:{DB},headers:new Headers({'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@test.invalid'})};
const out=path.join(project,'.local-build','billing-test.mjs');mkdirSync(path.dirname(out),{recursive:true});
const modules={billing:'lib/billing.ts',server:'lib/server.ts',organizations:'lib/organizations.ts',route:'app/api/billing/[...path]/route.ts',webhook:'app/api/webhooks/saspay/route.ts',tick:'app/api/internal/billing-tick/route.ts',admin:'app/api/admin/billing/route.ts',meter:'lib/metering.ts'};
await build({stdin:{contents:Object.entries(modules).map(([n,f])=>'export * as '+n+' from "'+path.join(project,f).replaceAll('\\','/')+'";').join('\n'),resolveDir:project,loader:'ts'},outfile:out,bundle:true,platform:'node',format:'esm',nodePaths:[runtime],plugins:[{name:'test-bindings',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__billingTest.env;':a.path==='next/headers'?'export async function headers(){return globalThis.__billingTest.headers;}':'export function redirect(){throw new Error("unexpected redirect");}'}));}}]});
const {billing:b,server:s,organizations:o,route,webhook,tick,admin,meter}=await import(pathToFileURL(out).href),env=globalThis.__billingTest.env;
let checks=0;const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{checks++;console.log('PASS '+name);});
const request=(method='GET',body,space='owner')=>new Request('https://aira.test/api/billing/summary',{method,headers:{'Content-Type':'application/json','x-aira-workspace':space},...(body?{body:JSON.stringify(body)}:{})});
const who=await s.identity(request());
await check('Launch gates default closed, free quota defaults zero',async()=>{assert.equal(b.releaseReadiness().enabled,false);await assert.rejects(()=>b.claimFree(who));});
await check('Anonymous catalogue is public; private summary requires identity',async()=>{const old=globalThis.__billingTest.headers;globalThis.__billingTest.headers=new Headers();assert.equal((await route.GET(request(),{params:Promise.resolve({path:['catalog']})})).status,200);assert.equal((await route.GET(request(),{params:Promise.resolve({path:['summary']})})).status,401);globalThis.__billingTest.headers=old;});
await check('Free allocation is one-time and globally capped',async()=>{env.FREE_DAILY_CREDITS='10';await b.claimFree(who);await b.claimFree(who);assert.equal((await b.summary('owner')).wallet.available,10);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_claims').get().n,1);});
await check('Reservations reject concurrent overspend and duplicate reference is idempotent',async()=>{const h=await b.reserve(who,'reservation-test',800);assert.equal((await b.reserve(who,'reservation-test',800)).id,h.id);await assert.rejects(()=>b.reserve(who,'overspend',300));await b.settleHold(h.id,500);await b.settleHold(h.id,900);assert.equal((await b.summary('owner')).wallet.available,5);});
const economics={taxBps:0,feeBps:500,feeFixed:100,unitCost:4,monthlyServiceCost:300,riskBps:100};
Object.assign(env,{SASPAY_SECRET_KEY:'sk_test_fixture',SASPAY_MERCHANT_ID:'merchant-fixture',SASPAY_WEBHOOK_SECRET:'fixture-only',SASPAY_ENV:'sandbox',BILLING_LEGAL_JSON:'{"name":"Test fixture"}',BILLING_ECONOMICS_JSON:JSON.stringify({pro:economics,business:economics}),SCHEDULER_SECRET:'scheduler-fixture'});
for(const k of ['XAF_CHECKOUT_VALIDATED','TAX_VALIDATED','BENCHMARKS_VALIDATED','SCHEDULER_VERIFIED','PROVIDER_TESTS_PASSED','SUPPORT_READY','TERMS_APPROVED','RESTORE_TESTED','WEBHOOK_VERIFIED','PRODUCT_ACCEPTANCE','ENABLED'])env['BILLING_'+k]='true';
const sessions=new Map(),transactions=new Map();let creates=0,timeout=false;
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
let order;
await check('Checkout uses immutable server amount; double click creates one session',async()=>{const q=await b.makeQuote(who,{kind:'topup',quantity:150});assert.equal(q.amount,7250);const key=crypto.randomUUID();order=await b.checkout(who,q.id,key,'https://aira.test');await b.checkout(who,q.id,key,'https://aira.test');assert.equal(creates,1);assert.equal((await b.summary('owner')).wallet.available,5);});
await check('Repeated and concurrent confirmations grant purchased credits once',async()=>{await Promise.all([b.reconcileOrder(order.id),b.reconcileOrder(order.id)]);await b.reconcileOrder(order.id);assert.equal((await b.summary('owner')).wallet.available,155);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_invoices').get().n,1);});
await check('Wrong currency cannot grant credits',async()=>{const q=await b.makeQuote(who,{kind:'topup',quantity:50});const pending=await b.checkout(who,q.id,crypto.randomUUID(),'https://aira.test');const row=sql.prepare('SELECT session_id FROM billing_orders WHERE id=?').get(pending.id);sessions.get(row.session_id).currency='USD';await assert.rejects(()=>b.reconcileOrder(pending.id));assert.equal((await b.summary('owner')).wallet.available,155);sessions.get(row.session_id).currency='XAF';await b.reconcileOrder(pending.id);});
await check('Uncertain checkout creation is recovered without another charge request',async()=>{timeout=true;const q=await b.makeQuote(who,{kind:'topup',quantity:50});await assert.rejects(()=>b.checkout(who,q.id,crypto.randomUUID(),'https://aira.test'));const row=sql.prepare('SELECT id FROM billing_orders WHERE quote_id=?').get(q.id),before=creates;timeout=false;await b.reconcileOrder(row.id);assert.equal(creates,before);assert.equal((await b.summary('owner')).wallet.available,255);});
let annualId;
await check('Annual purchase grants only first month; catch-up grants exactly twelve',async()=>{const q=await b.makeQuote(who,{kind:'subscription',plan:'pro',cycle:'annual'});const result=await b.checkout(who,q.id,crypto.randomUUID(),'https://aira.test');await b.reconcileOrder(result.id);annualId='sub:'+result.id;assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE source='subscription'").get().n,1);const sub=await b.currentSubscription('owner');await b.allocateDue('owner',sub.end_at-1);await b.allocateDue('owner',sub.end_at-1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE source='subscription'").get().n,12);});
await check('Cross-organization access and reader mutations are denied',async()=>{await assert.rejects(()=>s.authorize('owner','intruder','read'));sql.prepare("INSERT INTO organization_members VALUES ('owner','reader','reader',1,NULL)").run();sql.prepare("INSERT INTO members VALUES ('reader-membership','owner','reader','reader')").run();await assert.rejects(()=>s.authorize('owner','reader','read'));sql.prepare("UPDATE billing_subscriptions SET plan='business' WHERE id=?").run(annualId);assert.equal((await s.authorize('owner','reader','read')).role,'reader');await assert.rejects(()=>s.authorize('owner','reader','write'));await assert.rejects(()=>b.makeQuote({...who,role:'reader'},{kind:'topup',quantity:50}));});
await check('Refund request freezes purchased lot and cannot regrant payment',async()=>{await b.requestRefund(who,order.id,'Duplicate purchase, please review.');await b.reconcileOrder(order.id);assert.equal(sql.prepare('SELECT frozen FROM credit_lots WHERE source_id=?').get(order.id).frozen,1);assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(order.id).status,'refund_requested');});
await check('Webhook replay is durable, deduplicated, and never directly grants credits',async()=>{const body=JSON.stringify({event:'transaction.success',data:{id:'transaction-unrelated'}}),stamp=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',env.SASPAY_WEBHOOK_SECRET).update(stamp+'.'+body).digest('hex');const make=()=>new Request('https://aira.test/api/webhooks/saspay',{method:'POST',headers:{'x-webhook-timestamp':stamp,'x-webhook-signature':sig},body});assert.equal((await webhook.POST(make())).status,200);assert.equal((await webhook.POST(make())).status,200);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_events').get().n,1);assert.equal((await webhook.POST(new Request('https://aira.test/api/webhooks/saspay',{method:'POST',body}))).status,401);});
await check('Scheduler and admin routes deny untrusted access',async()=>{assert.equal((await tick.POST(request('POST',{}))).status,401);assert.equal((await admin.GET(request())).status,403);});
await check('Unverified and invalid model rates block paid model calls',async()=>{assert.throws(()=>meter.modelRate());env.ANTHROPIC_RATE_JSON=JSON.stringify({model:'claude-opus-5-5',input:5,output:25,cacheWrite:6.25,cacheRead:.5,usdXaf:600,overheadXaf:1,verifiedAt:'not-a-date'});assert.throws(()=>meter.modelRate());});
await check('Expired reserved credits settle once; released remainder expires without becoming topup',async()=>{
 const now=Date.now();sql.prepare('INSERT INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('expires-lot','expiry-org','subscription','sub',1000,1000,now-1000,now+10000,now);
 const h=await b.reserve({...who,organization:'expiry-org'},'expiry-test',800);sql.prepare("UPDATE credit_lots SET expires_at=? WHERE id='expires-lot'").run(now-1);await b.expireLots('expiry-org');assert.equal(sql.prepare("SELECT balance FROM credit_lots WHERE id='expires-lot'").get().balance,800);await b.settleHold(h.id,500);await b.settleHold(h.id,500);assert.equal(sql.prepare("SELECT balance FROM credit_lots WHERE id='expires-lot'").get().balance,0);assert.equal(sql.prepare("SELECT SUM(units) n FROM credit_ledger WHERE organization_id='expiry-org' AND kind='expire'").get().n,500);
});
await check('Actual upgrade keeps end date and prepayment does not grant another current quota',async()=>{
 globalThis.__billingTest.headers=new Headers({'oai-authenticated-user-id':'upgrade-owner','oai-authenticated-user-email':'upgrade@test.invalid'});const person=await s.identity(request('GET',undefined,'upgrade-owner'));
 const q=await b.makeQuote(person,{kind:'subscription',plan:'pro',cycle:'annual'}),order=await b.checkout(person,q.id,crypto.randomUUID(),'https://aira.test');await b.reconcileOrder(order.id);
 const before=await b.currentSubscription(person.organization),upgrade=await b.makeQuote(person,{kind:'upgrade'}),payment=await b.checkout(person,upgrade.id,crypto.randomUUID(),'https://aira.test');await Promise.all([b.reconcileOrder(payment.id),b.reconcileOrder(payment.id)]);
 const after=await b.currentSubscription(person.organization);assert.equal(after.end_at,before.end_at);assert.equal(after.plan,'business');assert.equal(after.version,2);assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE organization_id=? AND source='upgrade'").get(person.organization).n,1);
 const wallet=(await b.summary(person.organization)).wallet.available;
 const next=await b.makeQuote(person,{kind:'subscription',plan:'pro',cycle:'period'}),renew=await b.checkout(person,next.id,crypto.randomUUID(),'https://aira.test');await b.reconcileOrder(renew.id);assert.equal((await b.summary(person.organization)).wallet.available,wallet);assert.equal(sql.prepare('SELECT start_at FROM billing_subscriptions WHERE order_id=?').get(renew.id).start_at,before.end_at);
});
await check('Stale subscription quote is rejected before another provider request',async()=>{
 const person=await s.identity(request('GET',undefined,'upgrade-owner')),quote=await b.makeQuote(person,{kind:'topup',quantity:100}),before=creates;
 sql.prepare('UPDATE billing_subscriptions SET version=version+1 WHERE organization_id=?').run(person.organization);await assert.rejects(()=>b.checkout(person,quote.id,crypto.randomUUID(),'https://aira.test'));assert.equal(creates,before);
});
await check('Late upgrade payment is held for reconciliation without expired benefits',async()=>{
 globalThis.__billingTest.headers=new Headers({'oai-authenticated-user-id':'late-owner','oai-authenticated-user-email':'late@test.invalid'});const person=await s.identity(request('GET',undefined,'late-owner'));
 const q=await b.makeQuote(person,{kind:'subscription',plan:'pro',cycle:'annual'}),order=await b.checkout(person,q.id,crypto.randomUUID(),'https://aira.test');await b.reconcileOrder(order.id);
 const change=await b.makeQuote(person,{kind:'upgrade'}),payment=await b.checkout(person,change.id,crypto.randomUUID(),'https://aira.test'),original=Date.now;
 try{Date.now=()=>change.periodEnd+1000;await b.reconcileOrder(payment.id);}finally{Date.now=original;}
 assert.equal(sql.prepare('SELECT plan FROM billing_subscriptions WHERE order_id=?').get(order.id).plan,'pro');assert.equal(sql.prepare('SELECT status FROM billing_orders WHERE id=?').get(payment.id).status,'needs_reconciliation');assert.equal(sql.prepare("SELECT COUNT(*) n FROM credit_lots WHERE source_id=?").get(payment.id).n,0);
});
await check('Partial deliveries are charged, technical failure without a delivery is released',async()=>{
 const rate={input:5,output:25,cacheWrite:6.25,cacheRead:.5,usdXaf:600,overheadXaf:1},usage={input_tokens:1000,output_tokens:100};
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
console.log(`${checks} billing integration checks passed. Provider responses were simulated; no real payment or provider validation.`);sql.close();


