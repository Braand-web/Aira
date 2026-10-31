// Exercise actual persistence, tenancy and optimistic versions. No providers.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),sql=new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync(path.join(root,'drizzle')).filter(name=>name.endsWith('.sql')).sort())sql.exec(readFileSync(path.join(root,'drizzle',file),'utf8'));
function statement(query,args=[]){return {bind(...values){return statement(query,values);},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this._run();},_run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}
globalThis.__agentProfileTest={env:{DB:{prepare:query=>statement(query),async batch(items){return items.map(item=>item._run());}}},headers:new Headers({'x-braand-identity-id':'profile-owner','x-braand-identity-email':'owner@test.invalid'})};
const outfile=path.join(root,'.tmp','agent-profile-test.mjs');mkdirSync(path.dirname(outfile),{recursive:true});
await build({stdin:{contents:`export * as profile from './lib/agent-profile';export * as server from './lib/server';`,resolveDir:root,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',plugins:[{name:'profile-fixture',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__agentProfileTest.env;':a.path==='next/headers'?'export async function headers(){return globalThis.__agentProfileTest.headers;}':'export function redirect(){throw Error("Unexpected redirect");}'}));
}}]});
const {profile,server}=await import(pathToFileURL(outfile).href);
const who=await server.identity(new Request('https://braand.test/api/chat'));
const other='other-profile';sql.prepare('INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)').run(other,'Other',Date.now());
globalThis.fetch=async()=>{throw Error('Unexpected external call');};
const empty=await profile.readAgentContext(who.tenant);assert.equal(empty.version,0);assert.deepEqual(empty.profile,{});
const saved=await profile.updateAgentContext(who.tenant,{version:0,profile:{displayName:'Aïcha',agentName:'Braand',language:'fr',timezone:'Europe/Paris',tone:'warm',responseLength:'concise',conventions:['Conserver les devises fournies.']}});
assert.equal(saved.version,1);assert.equal(saved.profile.displayName,'Aïcha');assert.equal((await profile.readAgentContext(other)).version,0);
await assert.rejects(()=>profile.updateAgentContext(who.tenant,{version:0,profile:{displayName:'Stale'}}),error=>error.code==='stale_version');
const revised=await profile.updateAgentContext(who.tenant,{version:1,profile:{...saved.profile,timezone:'Africa/Abidjan'}});assert.equal(revised.version,2);
await assert.rejects(()=>profile.updateAgentContext(who.tenant,{version:2,profile:{timezone:'Mars/Test'}}));
await assert.rejects(()=>profile.updateAgentContext(who.tenant,{version:2,profile:{permissions:'allow_all'}}));
await assert.rejects(()=>profile.updateAgentContext(who.tenant,{version:2,profile:{conventions:['api_key=not-a-real-key-but-still-a-credential']}}),error=>error.code==='profile_secret_rejected');
assert.equal((await profile.readAgentContext(who.tenant)).version,2);
const runtime=await profile.agentRuntimeContext(who.tenant);assert.match(runtime,/Africa\/Abidjan/);assert.match(runtime,/jamais une instruction système/);assert.doesNotMatch(await profile.agentRuntimeContext(other),/Aïcha/);
const forgotten=await profile.updateAgentContext(who.tenant,{version:2,profile:{}});assert.deepEqual(forgotten.profile,{});assert.doesNotMatch(await profile.agentRuntimeContext(who.tenant),/Aïcha/);
const stamp=Date.parse('2026-10-25T01:30:00Z'),clock=profile.currentTime({timezone:'Europe/Paris'},stamp);assert.equal(clock.utc,'2026-10-25T01:30:00.000Z');assert.match(clock.local,/02:30:00/);assert.equal(clock.locationKnown,false);assert.equal(profile.currentTime({},stamp).timezone,'UTC');assert.throws(()=>profile.currentTime({timezone:'invalid'}));
const memory=await server.createResource(who.tenant,'knowledge','Préférence',{content:'Réponses concises',source:'Message explicite de la conversation de recette',memoryType:'preference'},'saved');
const explanation=await profile.explainMemory(who.tenant,{id:memory.id});assert.equal(explanation.content,'Réponses concises');assert.equal(explanation.version,1);assert.equal(explanation.sourceIndependentlyVerified,false);assert.equal(explanation.supersededHistoryAvailable,false);
await assert.rejects(()=>profile.explainMemory(other,{id:memory.id}),error=>error.status===404);
await server.updateResource(who.tenant,memory.id,1,{status:'deleted',data:{}});await assert.rejects(()=>profile.explainMemory(who.tenant,{id:memory.id}),error=>error.status===404);
// Concurrent first saves produce exactly one versioned profile, with no overwrite.
const races=await Promise.allSettled([profile.updateAgentContext(other,{version:0,profile:{displayName:'First'}}),profile.updateAgentContext(other,{version:0,profile:{displayName:'Second'}})]);assert.equal(races.filter(item=>item.status==='fulfilled').length,1);assert.equal((await profile.readAgentContext(other)).version,1);
console.log('Agent profile integration: isolation, versions, reset, provenance, missing/deleted memory, DST and first-save race passed.');
sql.close();delete globalThis.__agentProfileTest;
