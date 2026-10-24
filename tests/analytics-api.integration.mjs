// Exercise the real GET handler with explicit loopback fixtures; no Graph request occurs.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'.tmp','analytics-route-test.mjs');await mkdir(path.dirname(output),{recursive:true});
globalThis.__analyticsTest={calls:[],fail:'',unauthorized:false};
await build({entryPoints:[path.join(root,'app/api/meta/route.ts')],outfile:output,bundle:true,format:'esm',platform:'node',plugins:[{name:'analytics-fixtures',setup(builder){
 builder.onResolve({filter:/^@\/lib\/(server|providers)$/},args=>({path:args.path,namespace:'analytics-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'analytics-fixture'},args=>({loader:'js',contents:args.path.endsWith('/server')?`
 export async function identity(){if(globalThis.__analyticsTest.unauthorized)throw Object.assign(Error('Connexion requise'),{status:401});return {tenant:'fixture-workspace'};}
 export function failure(error){return Response.json({error:error.message},{status:error.status||400});}
 export function db(){throw Error('No writes allowed');}export async function auditLog(){throw Error('No writes allowed');}
 `:`
 export async function metaGet(tenant,route,params){
  const test=globalThis.__analyticsTest;test.calls.push({tenant,route,params});
  if(route==='me/adaccounts')return {data:[{id:'act_123',name:'Compte fixture',currency:'XAF',private:'never return'}],paging:{next:'https://graph.invalid/?access_token=fixture-secret'}};
  if(!route.endsWith('/insights'))return {id:'act_123',name:'Compte fixture',currency:'XAF',timezone_name:'Africa/Douala'};
  const daily=params.time_increment==='1';if(test.fail==='all'||test.fail==='daily'&&daily)throw Error('Lecture indisponible');
  return {data:[{campaign_name:'Campagne fixture',spend:'10',clicks:'2',impressions:'100',private:'never return'}],paging:{next:'https://graph.invalid/?access_token=fixture-secret'}};
 }` }));
}}]});
const {GET}=await import(pathToFileURL(output).href),fixture=globalThis.__analyticsTest;
const call=query=>GET(new Request('http://localhost/api/meta'+query));
let response=await call('');let body=await response.json();assert.equal(body.hasMore,true);assert.deepEqual(Object.keys(body.data[0]),['id','name','currency']);assert.ok(!JSON.stringify(body).includes('fixture-secret'));
fixture.calls=[];response=await call('?accountId=act_123&days=7');body=await response.json();assert.equal(response.status,200);assert.equal(fixture.calls.length,4);assert.ok(fixture.calls.every(call=>call.tenant==='fixture-workspace'));
const reads=fixture.calls.filter(call=>call.route.endsWith('/insights'));assert.equal(reads.length,3);assert.equal(reads[0].params.level,'campaign');assert.equal(reads[1].params.time_increment,'1');
const current=JSON.parse(reads[0].params.time_range),prior=JSON.parse(reads[2].params.time_range);assert.equal(reads[0].params.time_range,reads[1].params.time_range);assert.equal(Date.parse(current.since)-Date.parse(prior.since),7*86400000);assert.ok(prior.until<current.since);assert.equal(body.hasMore,true);assert.ok(!JSON.stringify(body).includes('fixture-secret'));assert.ok(!JSON.stringify(body).includes('never return'));
fixture.calls=[];assert.equal((await call('?accountId=act_123&days=31')).status,400);assert.equal((await call('?accountId=invalid')).status,400);assert.equal(fixture.calls.length,0);
fixture.fail='daily';body=await (await call('?accountId=act_123')).json();assert.equal(body.daily,null);assert.equal(body.comparison,null);assert.equal(body.warnings.length,2);assert.equal(body.insights.data.length,1);
fixture.fail='all';assert.equal((await call('?accountId=act_123')).status,400);
fixture.calls=[];fixture.unauthorized=true;assert.equal((await call('?accountId=act_123')).status,401);assert.equal(fixture.calls.length,0);
console.log('PASS analytics GET: tenant-scoped read-only requests, bounded dates, optional-data failures, validation and no Graph pagination secrets');
