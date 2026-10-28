// Real service, route and SQLite code; private R2 is simulated, no provider calls.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(path.join(root,'drizzle',name),'utf8'));
function statement(query,args=[]){return {bind(...values){return statement(query,values);},async first(column){const row=sql.prepare(query).get(...args);return column?row?.[column]??null:row??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this._run();},_run(){const row=sql.prepare(query).run(...args);return {meta:{changes:Number(row.changes)}};}};}
const DB={prepare:q=>statement(q),async batch(items){sql.exec('BEGIN');try{const result=items.map(s=>s._run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const blobs=new Map(),BUCKET={async put(key,data){blobs.set(key,new Uint8Array(data));},async delete(key){blobs.delete(key);},async get(key){const bytes=blobs.get(key);return bytes?{size:bytes.length,body:new Blob([bytes]).stream(),arrayBuffer:async()=>bytes.slice().buffer,text:async()=>new TextDecoder().decode(bytes)}:null;}};
globalThis.__internalEngines={env:{DB,BUCKET,FILE_PREVIEW_V1:'true',FILE_URL_SIGNING_SECRET:'isolated-signing-secret-'.repeat(3)},headers:new Headers({'x-braand-identity-id':'engine-fixture','x-braand-identity-email':'engine@test.invalid'})};
const fixture=globalThis.__internalEngines,runtime=process.env.BRAAND_TOOLCHAIN||path.join(root,'node_modules'),{build}=createRequire(path.join(runtime,'package.json'))('esbuild'),out=path.join(root,'.tmp/internal-engines-test.mjs');mkdirSync(path.dirname(out),{recursive:true});
await build({stdin:{contents:`export * as server from './lib/server.ts';export * as sources from './lib/source-projects.ts';export * as analysis from './lib/data-analysis.ts';export * as documents from './lib/document-delivery.ts';export * as generated from './lib/generated-files.ts';export * as files from './app/api/files/[id]/[action]/route.ts';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:out,nodePaths:[runtime],plugins:[{name:'private-engine-fixture',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__internalEngines.env;':a.path==='next/headers'?'export async function headers(){return globalThis.__internalEngines.headers;}':'export function redirect(){throw Error("Unexpected redirect");}'}));}}]});
const {server,sources,analysis,documents,files,generated}=await import(pathToFileURL(out).href);globalThis.fetch=async()=>{throw Error('Provider/network calls forbidden');};
const who=await server.identity(new Request('https://fixture.test/api/workspace'));let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
let project,computed;
await check('source files are actually persisted, exported and read progressively without claiming execution',async()=>{
 project=await sources.saveSourceProject(who,{title:'Projet source',summary:'Prototype non exécuté',files:[{path:'src/app.js',content:'export const greeting="مرحبا";'},{path:'README.md',content:'# Exemple'}]});
 assert.equal(project.execution,'not_executed');assert.equal(project.tests,'not_run');assert.equal(project.deployment,'not_deployed');assert.equal(project.file.kind,'file');assert.equal(project.file.data.mime,'application/zip');assert.equal(blobs.size,1);
 const manifest=await sources.getSourceProject(who,{id:project.id});assert.equal(manifest.files.length,2);assert.equal('content' in manifest.files[0],false);await assert.rejects(()=>sources.getSourceProject(who,{id:project.id,path:'src/app.js'}));
 const code=await sources.getSourceProject(who,{id:project.id,version:1,path:'src/app.js'});assert.equal(code.content,'export const greeting="مرحبا";');
});
await check('project revisions retain untouched files, preserve old archives and reject stale or hostile writes',async()=>{
 const first=project;project=await sources.saveSourceProject(who,{id:first.id,version:1,title:first.title,summary:'Révision ciblée',files:[{path:'src/app.js',content:'export const greeting="Bonjour";'}]});
 assert.equal(project.version,2);assert.equal(project.manifest.length,2);assert.equal((await sources.getSourceProject(who,{id:project.id,version:2,path:'README.md'})).content,'# Exemple');assert.equal(sql.prepare('SELECT status FROM files WHERE id=?').get(first.file.id).status,'ready');
 const before=blobs.size;await assert.rejects(()=>sources.saveSourceProject(who,{id:project.id,version:1,title:'Périmé',summary:'x',files:[]}),e=>e.code==='stale_version');
 await assert.rejects(()=>sources.saveSourceProject(who,{id:project.id,version:2,title:'Invalide',summary:'x',files:[{path:'../secret',content:'x'}]}));assert.equal(blobs.size,before);assert.equal((await server.getResource(who.tenant,project.id)).version,2);
});
await check('data operations produce exact values, a real CSV and reproducible input/output provenance',async()=>{
 computed=await analysis.analyzeData(who,{title:'Mesures fournies',dataset:{format:'inline',columns:['Pays','Montant'],rows:[['CM','0.1'],['CM','0.2'],['FR',null]]},steps:[{op:'group',by:['Pays'],aggregates:[{op:'sum',column:'Montant',as:'total'}]}]});
 assert.equal(computed.execution,'computed');assert.deepEqual(computed.preview,[['CM','0.3'],['FR',null]]);assert.equal(computed.inputRows,3);assert.equal(computed.externalChanges,false);assert.match(computed.inputHash,/^[a-f0-9]{64}$/);
 const stored=await server.getResource(who.tenant,computed.id);assert.equal(stored.data.analysis.source.input.rows.length,3);
 const file=sql.prepare('SELECT * FROM files WHERE id=?').get(computed.file.id),csv=new TextDecoder().decode(blobs.get(file.storage_key));assert.match(csv,/"CM","0.3"/);assert.equal(file.workspace_id,who.tenant);
 const again=await analysis.analyzeData(who,{title:'Suite de l’analyse',dataset:{format:'analysis',analysisId:computed.id,version:1},steps:[{op:'filter',column:'total',operator:'not_empty'}]});assert.deepEqual(again.preview,[['CM','0.3']]);
});
await check('owned file analysis validates bytes and source version, instead of trusting filenames',async()=>{
 const input={title:'Lire le CSV',dataset:{format:'csv',fileId:computed.file.id,version:1},steps:[]};const result=await analysis.analyzeData(who,input);assert.equal(result.inputRows,2);
 await assert.rejects(()=>analysis.analyzeData(who,{...input,dataset:{...input.dataset,version:99}}),e=>e.code==='analysis_source_invalid');
 const file=sql.prepare('SELECT * FROM files WHERE id=?').get(computed.file.id),old=blobs.get(file.storage_key);blobs.set(file.storage_key,new TextEncoder().encode('changed'));await assert.rejects(()=>analysis.analyzeData(who,input),e=>e.code==='analysis_source_changed');blobs.set(file.storage_key,old);
});
await check('bounded result pages are explicit and can never masquerade as the full result',async()=>{
 const page=await analysis.getAnalysisResult(who,{id:computed.id,limit:1});assert.equal(page.rows.length,1);assert.equal(page.totalRows,2);assert.equal(page.truncated,true);assert.equal(page.nextOffset,1);
 const last=await analysis.getAnalysisResult(who,{id:computed.id,offset:1,limit:1});assert.equal(last.nextOffset,null);assert.equal(last.truncated,true);await assert.rejects(()=>analysis.getAnalysisResult(who,{id:computed.id,limit:51}));
});
await check('source archives use the existing authenticated signed attachment download route',async()=>{
 const signed=await files.POST(new Request('https://fixture.test/api/files/'+project.file.id+'/url',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://fixture.test'},body:JSON.stringify({scope:'download'})}),{params:Promise.resolve({id:project.file.id,action:'url'})});assert.equal(signed.status,200);const {url}=await signed.json();
 const response=await files.GET(new Request(url),{params:Promise.resolve({id:project.file.id,action:'download'})});assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/^attachment/);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.ok((await response.arrayBuffer()).byteLength>0);
 const denied=await files.GET(new Request('https://fixture.test/api/files/'+project.file.id+'/download'),{params:Promise.resolve({id:project.file.id,action:'download'})});assert.equal(denied.status,404);
});
await check('foreign workspaces and read-only members cannot obtain files or create analyses/projects',async()=>{
 fixture.headers=new Headers({'x-braand-identity-id':'other-engine-fixture','x-braand-identity-email':'other-engine@test.invalid'});const other=await server.identity(new Request('https://fixture.test/api/workspace'));
 await assert.rejects(()=>sources.getSourceProject(other,{id:project.id}),e=>e.status===404);await assert.rejects(()=>analysis.getAnalysisResult(other,{id:computed.id}),e=>e.status===404);
 fixture.headers=new Headers({'x-braand-identity-id':'engine-fixture','x-braand-identity-email':'engine@test.invalid'});sql.prepare("UPDATE organization_members SET role='reader' WHERE user_id=? AND organization_id=?").run(who.user.userId,who.organization);
 const count=blobs.size;await assert.rejects(()=>sources.saveSourceProject(who,{title:'Denied',summary:'x',files:[{path:'a.js',content:'x'}]}),e=>e.status===403);await assert.rejects(()=>analysis.analyzeData(who,{title:'Denied',dataset:{format:'inline',columns:['x'],rows:[[1]]},steps:[]}),e=>e.status===403);assert.equal(blobs.size,count);sql.prepare("UPDATE organization_members SET role='owner' WHERE user_id=? AND organization_id=?").run(who.user.userId,who.organization);
});
await check('a failed file transaction removes its blob and cannot fabricate a successful output',async()=>{
 const before=blobs.size;sql.exec("CREATE TRIGGER reject_engine_file BEFORE INSERT ON files BEGIN SELECT RAISE(ABORT,'engine_storage_failure'); END;");
 try{await assert.rejects(()=>sources.saveSourceProject(who,{title:'Storage failure',summary:'Préserver les sources',files:[{path:'index.js',content:'export const answer=42;'}]}));}finally{sql.exec('DROP TRIGGER reject_engine_file');}assert.equal(blobs.size,before);
 const kept=sql.prepare("SELECT data FROM resources WHERE title='Storage failure'").get();assert.equal(JSON.parse(kept.data).files[0].content,'export const answer=42;');
 const doc=await server.createResource(who.tenant,'deliverable','Report',{content:'Export still works',sources:[]},'draft'),file=await documents.exportDeliverable(who,{id:doc.id,version:1,format:'docx'});assert.equal(file.status,'ready');
});
await check('parallel file exports cannot exceed the workspace quota or meter a rejected file',async()=>{
 const existing=sql.prepare("SELECT COUNT(*) n FROM files WHERE workspace_id=? AND status!='deleted'").get(who.tenant).n;
 for(let i=existing;i<99;i++)sql.prepare("INSERT INTO files(id,workspace_id,display_name,storage_name,size_bytes,detected_mime,status,created_at,updated_at) VALUES (?,?,?,?,0,'text/plain','ready',?,?)").run('quota:'+i,who.tenant,'quota','quota',Date.now(),Date.now());
 const before=sql.prepare('SELECT COUNT(*) n FROM billing_meter WHERE organization_id=?').get(who.organization).n,source=await server.getResource(who.tenant,project.id);
 const outcomes=await Promise.allSettled(['one','two'].map(value=>generated.saveGeneratedFile(who,{source,name:value+'.txt',mime:'text/plain',format:'txt',bytes:new TextEncoder().encode('quota unique '+value)})));
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(outcomes.filter(r=>r.status==='rejected'&&r.reason.code==='file_quota_exceeded').length,1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM files WHERE workspace_id=? AND status!='deleted'").get(who.tenant).n,100);assert.equal(sql.prepare('SELECT COUNT(*) n FROM billing_meter WHERE organization_id=?').get(who.organization).n,before+1);
 sql.prepare("DELETE FROM files WHERE id LIKE 'quota:%'").run();
});
console.log(`${checks} internal engine checks passed. Provider calls: 0; R2 simulated; real SQLite/services/download route.`);sql.close();delete globalThis.__internalEngines;
