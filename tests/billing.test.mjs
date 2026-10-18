import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {topupPrice,PACKS,periods,anniversary,marginCheck,product,upgradeQuote,usageUnits,verifyWebhook,roleAllows,decimalXaf} from '../lib/billing-core.mjs';
test('Fixed packs and custom tiers use identical, monotonic integer XAF pricing',()=>{
 assert.deepEqual(PACKS.map(topupPrice),[2500,5000,11750,23000,45000,109500,217000]);
 assert.equal(topupPrice(150),7250);assert.equal(topupPrice(10000),432000);
 let previous=0;for(let n=50;n<=10000;n++){const p=topupPrice(n);assert(Number.isInteger(p)&&p>previous);previous=p;}
 for(const value of [-1,0,49,50.5,10001,NaN,Infinity,'100'])assert.throws(()=>topupPrice(value));
});
test('Annual calendar anchors survive February, leap years and month-end',()=>{
 const start=Date.parse('2024-01-31T14:05:00Z'),p=periods(start,'annual',200);
 assert.equal(p.length,12);assert.equal(p.reduce((n,x)=>n+x.units,0),240000);
 assert.equal(new Date(p[1].start).toISOString(),'2024-02-29T14:05:00.000Z');
 assert.equal(new Date(p[2].start).toISOString(),'2024-03-31T14:05:00.000Z');
 assert.equal(new Date(p[11].end).toISOString(),'2025-01-31T14:05:00.000Z');
 assert.equal(new Date(anniversary(Date.parse('2023-01-31T00:00:00Z'),1)).getUTCDate(),28);
 assert.equal(periods(start,'period',200)[0].end-start,30*86400000);
});
test('Margin gate includes all annual credits, tax and payment fees',()=>{
 const p=product({kind:'subscription',plan:'pro',cycle:'annual'});
 assert.equal(marginCheck(p,{}).eligible,false);
 const e={taxBps:0,feeBps:500,feeFixed:100,unitCost:4,monthlyServiceCost:300,riskBps:100};
 const r=marginCheck(p,e);assert.equal(r.fullConsumptionCredits,2400);assert(r.margin>=.75);
 assert.equal(marginCheck(p,{...e,unitCost:15}).eligible,false);
 assert(marginCheck(p,{...e,taxBps:1925}).netRevenue<r.netRevenue);
});
test('Upgrade prorates price and credit difference, never grants a second full quota',()=>{
 const start=Date.parse('2026-01-01Z'),sub={plan:'pro',cycle:'period',start_at:start,end_at:start+30*86400000};
 const q=upgradeQuote(sub,start+15*86400000);assert.equal(q.amount,10000);assert.equal(q.units,20000);assert.equal(q.periodEnd,sub.end_at);
 assert.throws(()=>upgradeQuote({...sub,plan:'business'},start));
 const tiny={kind:'upgrade',...upgradeQuote(sub,sub.end_at-3600000)},e={taxBps:0,feeBps:500,feeFixed:100,unitCost:4,monthlyServiceCost:300,riskBps:100};
 assert.equal(tiny.amount,28);assert.equal(marginCheck(tiny,e).eligible,false);
});
test('Usage includes cache; malformed or partial provider amounts are rejected',()=>{
 const r=usageUnits({input_tokens:1000,output_tokens:200,cache_creation_input_tokens:300,cache_read_input_tokens:400},{input:5,output:25,cacheWrite:6.25,cacheRead:.5,usdXaf:600,overheadXaf:1});
 assert(Math.abs(r.xaf-8.245)<.00001);assert.equal(r.units,207);
 assert.throws(()=>usageUnits({input_tokens:1000},{}));
 assert.equal(decimalXaf('9900.00'),9900);for(const n of ['9900.1','1e3','-5','Infinity'])assert.throws(()=>decimalXaf(n));
});
test('Webhook requires authentic raw body and fresh timestamp',async()=>{
 const now=Date.now(),stamp=String(Math.floor(now/1000)),body='{"event":"transaction.success"}',secret='test-only-secret';
 const signature=createHmac('sha256',secret).update(stamp+'.'+body).digest('hex');const h=new Headers({'x-webhook-timestamp':stamp,'x-webhook-signature':signature});
 assert(await verifyWebhook(body,h,secret,now));assert.equal(await verifyWebhook(body+' ',h,secret,now),false);assert.equal(await verifyWebhook(body,h,secret,now+301000),false);
});
test('Roles separate approval, spending and financial ownership',()=>{
 assert(roleAllows('owner','billing'));assert(!roleAllows('admin','billing'));assert(!roleAllows('reader','write'));assert(roleAllows('approver','approve'));assert(!roleAllows('approver','write'));assert(!roleAllows('editor','approve'));
});
function database(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));return db;}
test('Ledger triggers reject double spending, preserve reservations after expiry and are immutable',()=>{
 const db=database(),now=Date.now();db.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run('org','Example','user',now);
 db.prepare('INSERT INTO workspaces(id,name,created_at,organization_id) VALUES (?,?,?,?)').run('space','Space',now,'org');
 db.prepare('INSERT INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('lot','org','subscription','sub',1000,1000,now-1000,now+1000,now);
 const hold=db.prepare('INSERT INTO credit_holds(id,organization_id,workspace_id,actor,reference,units,created_at) VALUES (?,?,?,?,?,?,?)');hold.run('h1','org','space','user','r1',800,now);hold.run('h2','org','space','user','r2',400,now);
 const a=db.prepare('INSERT INTO credit_allocations(id,hold_id,lot_id,units,created_at) VALUES (?,?,?,?,?)');a.run('a1','h1','lot',800,now);assert.throws(()=>a.run('a2','h2','lot',400,now),/insufficient_credits/);
 db.prepare('UPDATE credit_lots SET expires_at=? WHERE id=?').run(now-1,'lot');
 db.exec("UPDATE credit_allocations SET charged=500,state='settled' WHERE id='a1'");
 assert.deepEqual({...db.prepare('SELECT balance,reserved FROM credit_lots').get()},{balance:500,reserved:0});
 assert.throws(()=>a.run('a3','h2','lot',300,now),/insufficient_credits/);
 assert.throws(()=>db.exec("UPDATE credit_allocations SET charged=100 WHERE id='a1'"),/allocation_final/);
 assert.throws(()=>db.exec('DELETE FROM credit_ledger'),/immutable_ledger/);db.close();
});
test('Budget limits are checked before a concurrent hold can be inserted',()=>{
 const db=database(),now=Date.now();db.prepare('INSERT INTO billing_limits VALUES (?,?,?,?)').run('org','organization','org',1000);
 const hold=db.prepare('INSERT INTO credit_holds(id,organization_id,workspace_id,actor,reference,units,created_at) VALUES (?,?,?,?,?,?,?)');hold.run('h1','org','space','user','r1',700,now);
 assert.throws(()=>hold.run('h2','org','space','user','r2',400,now),/spend_limit/);db.close();
});
