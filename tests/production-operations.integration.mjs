// Real SQLite, Web Crypto, route handlers and recovery drill. HTTP providers are simulated.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const project=path.resolve(import.meta.dirname,'..'), runtime=process.env.AIRA_TOOLCHAIN||path.join(project,'node_modules');
const {build}=createRequire(path.join(runtime,'package.json'))('esbuild');
function database(migrate=false) {
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
  if(migrate)for(const file of readdirSync(path.join(project,'drizzle')).filter(name=>name.endsWith('.sql')).sort())sql.exec(readFileSync(path.join(project,'drizzle',file),'utf8'));
  function statement(query,args=[]) {return {
    bind(...values){return statement(query,values);},
    async first(column){const row=sql.prepare(query).get(...args);return column?row?.[column]??null:row??null;},
    async all(){return {results:sql.prepare(query).all(...args)};},
    async run(){return this.execute();},
    execute(){const prepared=sql.prepare(query);if(prepared.columns().length)return {results:prepared.all(...args),meta:{changes:0}};const value=prepared.run(...args);return {results:[],meta:{changes:Number(value.changes)}};}
  };}
  const binding={prepare:query=>statement(query),async batch(statements){sql.exec('BEGIN');try{const result=statements.map(value=>value.execute());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  return {sql,binding};
}
function bucket() {
  const objects=new Map();let serial=0;
  const binding={
    async put(key,body,options={}) {
      if(options.onlyIf?.etagDoesNotMatch==='*'&&objects.has(key))return null;
      const raw=typeof body==='string'?new TextEncoder().encode(body):new Uint8Array(body);
      const item={key,raw:Uint8Array.from(raw),etag:'fixture-'+(++serial),size:raw.byteLength,httpMetadata:options.httpMetadata||{},customMetadata:options.customMetadata||{}};
      objects.set(key,item);return {...item};
    },
    async get(key,options={}) {
      const item=objects.get(key);if(!item)return null;
      if(options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==item.etag)return {key,etag:item.etag,size:item.size};
      return {...item,body:new ReadableStream(),async arrayBuffer(){return item.raw.slice().buffer;},async text(){return new TextDecoder().decode(item.raw);}};
    },
    async list({limit=100,cursor}={}) {const rows=[...objects.values()].sort((a,b)=>a.key.localeCompare(b.key)),offset=Number(cursor||0);return {objects:rows.slice(offset,offset+limit).map(({raw,...item})=>item),truncated:offset+limit<rows.length,cursor:offset+limit<rows.length?String(offset+limit):undefined};}
  };
  return {objects,binding};
}
const source=database(true), media=bucket(), archives=bucket();
const env={DB:source.binding,BUCKET:media.binding,BACKUP_BUCKET:archives.binding,APP_ENV:'test'};
globalThis.__operationsTest={env,headers:new Headers({'oai-authenticated-user-id':'ops-owner','oai-authenticated-user-email':'ops@test.invalid'})};
const out=path.join(project,'.local-build','production-operations-test.mjs');mkdirSync(path.dirname(out),{recursive:true});
const modules={operations:'lib/operations.ts',notifications:'lib/notifications.ts',backups:'lib/backups.ts',health:'app/api/health/route.ts',tick:'app/api/internal/operations-tick/route.ts',admin:'app/api/admin/operations/route.ts'};
await build({stdin:{contents:Object.entries(modules).map(([name,file])=>'export * as '+name+' from "'+path.join(project,file).replaceAll('\\','/')+'";').join('\n'),resolveDir:project,loader:'ts'},outfile:out,bundle:true,platform:'node',format:'esm',nodePaths:[runtime],plugins:[{name:'isolated-operations-bindings',setup(builder){builder.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},args=>({path:args.path,namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='cloudflare:workers'?'export const env=globalThis.__operationsTest.env;':args.path==='next/headers'?'export async function headers(){return globalThis.__operationsTest.headers;}':'export function redirect(){throw new Error("unexpected redirect");}'}));}}]});
const {operations:ops,notifications:email,backups,health,tick,admin}=await import(pathToFileURL(out).href);
let checks=0;const check=async(name,work)=>{await work();checks++;console.log('PASS '+name);};
const originalFetch=globalThis.fetch;const calls=[];let fetchMode='success';
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails','No unapproved external host');calls.push({url,options});
  if(fetchMode==='timeout')throw new Error('fixture-secret-must-not-be-logged');
  return Response.json({id:'fixture-email-'+calls.length},{status:200});
};
const req=(method='POST',body,authorization,origin='https://aira.test')=>new Request('https://aira.test/api/admin/operations',{method,headers:{'Content-Type':'application/json',...(authorization?{authorization}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});

try {
  await check('Public health exposes no configuration, and missing DB returns 503',async()=>{
    assert.deepEqual(await (await health.GET()).json(),{status:'ok'});
    delete env.DB;assert.equal((await health.GET()).status,503);env.DB=source.binding;
  });
  await check('Scheduler refuses absent, short and incorrect secrets; accepts an exact long secret',async()=>{
    assert.equal((await tick.POST(req())).status,503);
    env.SCHEDULER_SECRET='short';assert.equal((await tick.POST(req())).status,503);
    env.SCHEDULER_SECRET='test-only-scheduler-'.repeat(3);
    assert.equal((await tick.POST(req('POST',undefined,'Bearer wrong'))).status,401);
    assert.equal((await tick.POST(req('POST',undefined,'Bearer '+env.SCHEDULER_SECRET))).status,200);
    assert.equal(calls.length,0);
  });
  await check('A claimed job executes once despite repeated concurrent ticks',async()=>{
    let executions=0;await Promise.all(Array.from({length:4},()=>ops.runTrackedJob('fixture','fixture:once',async()=>{executions++;})));
    assert.equal(executions,1);assert.equal(source.sql.prepare("SELECT attempts FROM operations_jobs WHERE id='fixture:once'").get().attempts,1);
  });
  await check('Failed jobs create one durable alert and one outbox entry; no secrets are recorded',async()=>{
    await ops.runTrackedJob('fixture','fixture:failure',async()=>{throw new Error('fixture-sensitive-error-never-store');});
    await ops.runTrackedJob('fixture','fixture:failure',async()=>{throw new Error('not-run');});
    assert.equal(source.sql.prepare("SELECT count(*) n FROM operations_alerts WHERE id='job:fixture:failure'").get().n,1);
    assert.equal(source.sql.prepare("SELECT count(*) n FROM notification_outbox WHERE id='job:fixture:failure'").get().n,1);
    assert(!JSON.stringify(source.sql.prepare('SELECT * FROM operations_jobs').all()).includes('sensitive'));
    const row=source.sql.prepare("SELECT status FROM operations_jobs WHERE id='fixture:failure'").get();assert.equal(row.status,'failed');
  });
  await check('Email is disabled by default, then blocks without a test recipient',async()=>{
    assert.equal(email.emailReadiness().reason,'email_disabled');
    await email.dispatchOperationalNotifications();assert.equal(calls.length,0);
    Object.assign(env,{RESEND_MODE:'sandbox',RESEND_API_KEY:'fixture-not-a-real-key',RESEND_FROM:'sender@test.invalid'});
    assert.equal(email.emailReadiness().reason,'test_recipient_missing');
    await email.dispatchOperationalNotifications();assert.equal(calls.length,0);
  });
  await check('Configured sandbox emails use explicit recipient and idempotency; repeated dispatch does not resend',async()=>{
    env.RESEND_TEST_RECIPIENT='recipient@test.invalid';
    const result=await email.dispatchOperationalNotifications();assert.equal(result.sent,1);
    assert.equal(calls[0].options.headers['Idempotency-Key'],'aira-ops/job:fixture:failure');
    assert.deepEqual(JSON.parse(calls[0].options.body).to,['recipient@test.invalid']);
    await email.dispatchOperationalNotifications();assert.equal(calls.length,1);
  });
  await check('Timeout remains uncertain and does not auto-resend, even past provider idempotency expiry',async()=>{
    await ops.raiseOperationalAlert('fixture:timeout','test_alert','fixture:timeout');fetchMode='timeout';
    await email.dispatchOperationalNotifications();const count=calls.length;
    await email.dispatchOperationalNotifications(10,Date.now()+2*86400000);
    assert.equal(calls.length,count);assert.equal(source.sql.prepare("SELECT status FROM notification_outbox WHERE id='fixture:timeout'").get().status,'uncertain');
    await ops.scanOperationalIncidents();await ops.scanOperationalIncidents();
    assert.equal(source.sql.prepare("SELECT count(*) n FROM notification_outbox WHERE payload LIKE '%email_delivery_unknown%'").get().n,0);
    fetchMode='success';
  });
  await check('Live mail needs an explicit approval flag; staging cannot accidentally send live',async()=>{
    env.RESEND_MODE='live';assert.equal(email.emailReadiness().ready,false);
    env.APP_ENV='production';assert.equal(email.emailReadiness().reason,'live_email_not_approved');
    env.RESEND_LIVE_APPROVED='true';assert.equal(email.emailReadiness().reason,'alert_recipient_missing');
    env.APP_ENV='test';env.RESEND_MODE='disabled';
  });
  await check('Operations administration requires an explicit admin ID and same-origin mutation',async()=>{
    assert.equal((await admin.GET(req('GET'))).status,403);env.OPS_ADMIN_IDS='ops-owner';
    assert.equal((await admin.GET(req('GET'))).status,200);
    const body={action:'test-alert',idempotencyKey:crypto.randomUUID()};
    assert.equal((await admin.POST(req('POST',body,undefined,'https://evil.test'))).status,403);
    assert.equal((await admin.POST(req('POST',body))).status,201);
    assert.equal((await admin.POST(req('POST',body))).status,201);
    assert.equal(source.sql.prepare('SELECT count(*) n FROM notification_outbox WHERE id=?').get('test:'+body.idempotencyKey).n,1);
  });
  await check('Backup blocks by default and requires a distinct bucket, valid key and maintenance acknowledgment',async()=>{
    await assert.rejects(()=>backups.createEncryptedBackup());
    env.BACKUP_ENABLED='true';env.BACKUP_MAINTENANCE_CONFIRMED='true';env.BACKUP_ENCRYPTION_KEY=btoa('k'.repeat(32));
    env.BACKUP_BUCKET=media.binding;await assert.rejects(()=>backups.createEncryptedBackup());env.BACKUP_BUCKET=archives.binding;
    env.BACKUP_ENCRYPTION_KEY=btoa('short');await assert.rejects(()=>backups.createEncryptedBackup());env.BACKUP_ENCRYPTION_KEY=btoa('k'.repeat(32));
  });
  const now=Date.now();
  source.sql.prepare("INSERT INTO credit_lots(id,organization_id,source,source_id,granted,balance,starts_at,created_at) VALUES ('restore-lot','ops-owner','test','fixture',500,500,?,?)").run(now,now);
  source.sql.prepare("INSERT INTO resources(id,workspace_id,kind,title,data,created_at,updated_at) VALUES ('restore-conversation','ops-owner','conversation','Recovery drill','{}',?,?)").run(now,now);
  source.sql.prepare("INSERT INTO runs(id,workspace_id,conversation_id,status,created_at,updated_at) VALUES ('restore-run','ops-owner','restore-conversation','completed',?,?)").run(now,now);
  source.sql.prepare("INSERT INTO events(seq,run_id,type,data,created_at) VALUES (100,'restore-run','test','{}',?)").run(now);
  source.sql.prepare("DELETE FROM events WHERE seq=100").run();
  await media.binding.put('ops-owner/files/fixture.txt','sensitive-fixture-content',{httpMetadata:{contentType:'text/plain'},customMetadata:{fixture:'yes'}});
  const expectedTables=source.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' ORDER BY name").all().map(row=>row.name);
  const expected=Object.fromEntries(expectedTables.map(name=>[name,source.sql.prepare('SELECT * FROM "'+name+'"').all()]));
  const archive=await backups.createEncryptedBackup();
  await check('Real AES-GCM archive contains no plaintext and restores real SQLite data plus objects without duplicate financial writes',async()=>{
    const stored=archives.objects.get('aira-backups/'+archive.id+'.bin');assert(!Buffer.from(stored.raw).includes(Buffer.from('sensitive-fixture-content')));
    const target=database(),targetMedia=bucket();env.BACKUP_RESTORE_ALLOWED='true';
    const result=await backups.restoreEncryptedBackup(archive.id,target.binding,targetMedia.binding);
    assert.equal(result.objects,1);assert.equal(result.tables,expectedTables.length);
    for(const name of expectedTables)assert.deepEqual(target.sql.prepare('SELECT * FROM "'+name+'"').all(),expected[name],name+' rows must match exactly');
    assert.equal(target.sql.prepare("SELECT count(*) n FROM credit_ledger WHERE lot_id='restore-lot'").get().n,1);
    assert.equal(target.sql.prepare("SELECT seq FROM sqlite_sequence WHERE name='events'").get().seq,100);
    assert.equal(await (await targetMedia.binding.get('ops-owner/files/fixture.txt')).text(),'sensitive-fixture-content');
    assert.deepEqual(targetMedia.objects.get('ops-owner/files/fixture.txt').customMetadata,{fixture:'yes'});
    assert.deepEqual(target.sql.prepare('PRAGMA foreign_key_check').all(),[]);target.sql.close();
  });
  await check('Restore refuses production, same source, existing destination, wrong key and modified ciphertext before writes',async()=>{
    const target=database(),targetMedia=bucket();env.APP_ENV='production';await assert.rejects(()=>backups.restoreEncryptedBackup(archive.id,target.binding,targetMedia.binding));env.APP_ENV='test';
    await assert.rejects(()=>backups.restoreEncryptedBackup(archive.id,source.binding,targetMedia.binding));
    target.sql.exec('CREATE TABLE existing(id TEXT)');await assert.rejects(()=>backups.restoreEncryptedBackup(archive.id,target.binding,targetMedia.binding));target.sql.close();
    const empty=database();env.BACKUP_ENCRYPTION_KEY=btoa('x'.repeat(32));await assert.rejects(()=>backups.restoreEncryptedBackup(archive.id,empty.binding,targetMedia.binding));env.BACKUP_ENCRYPTION_KEY=btoa('k'.repeat(32));
    const stored=archives.objects.get('aira-backups/'+archive.id+'.bin');stored.raw[25]^=1;
    await assert.rejects(()=>backups.restoreEncryptedBackup(archive.id,empty.binding,targetMedia.binding));
    assert.equal(targetMedia.objects.size,0);assert.equal(empty.sql.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n,0);empty.sql.close();
  });
  console.log(`${checks} production operations checks passed. SQLite/crypto recovery is real; Resend and R2 were simulated. No external mail or production restore.`);
} finally {globalThis.fetch=originalFetch;source.sql.close();}
