import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentConfig} from '../scripts/cloudflare-config.mjs';
const input={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),AIRA_STAGING_D1_ID:'12345678-1234-4234-8234-123456789abc',AIRA_STAGING_FILES_BUCKET:'aira-staging-files',AIRA_STAGING_BACKUPS_BUCKET:'aira-staging-backups'};
const built={main:'index.js',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],durable_objects:{bindings:[{name:'BROWSER_SESSIONS',class_name:'BrowserSession'}]},browser:{binding:'BROWSER'},migrations:[{tag:'browser-sessions-v1',new_sqlite_classes:['BrowserSession']}]};
test('Cloudflare deployments keep resource isolation and start closed',()=>{const c=deploymentConfig('staging',input,built,'/aira');assert.equal(c.workers_dev,false);assert.equal(c.preview_urls,false);assert.deepEqual(c.routes,[]);assert.equal(c.vars.AUTH_ENABLED,'false');assert.equal(c.vars.BILLING_ENABLED,'false');assert.equal(c.vars.SASPAY_ENV,'sandbox');assert.equal(c.vars.COMPOSIO_INSTANT_ENABLED,'false');assert.equal(c.d1_databases[0].database_id,input.AIRA_STAGING_D1_ID);assert.equal(c.r2_buckets[1].binding,'BACKUP_BUCKET');assert.deepEqual(c.triggers.crons,['*/5 * * * *','* * * * *']);assert.equal(c.browser.binding,'BROWSER');assert.equal(c.observability.enabled,false);});
test('missing or placeholder cloud resources are rejected',()=>{for(const patch of [{CLOUDFLARE_ACCOUNT_ID:''},{AIRA_STAGING_D1_ID:'00000000-0000-4000-8000-000000000000'},{AIRA_STAGING_FILES_BUCKET:''},{AIRA_STAGING_BACKUPS_BUCKET:input.AIRA_STAGING_FILES_BUCKET}])assert.throws(()=>deploymentConfig('staging',{...input,...patch},built));});
test('staging cannot reuse a production database or bucket',()=>{for(const suffix of ['D1_ID','FILES_BUCKET','BACKUPS_BUCKET'])assert.throws(()=>deploymentConfig('staging',{...input,['AIRA_PRODUCTION_'+suffix]:input['AIRA_STAGING_'+suffix]},built));});
test('deployment cannot target an arbitrary environment or obsolete build',()=>{assert.throws(()=>deploymentConfig('live',input,built));assert.throws(()=>deploymentConfig('staging',input,{...built,main:'untrusted.js'}));});

test('database-only staging remains private and cannot advertise files or backups',()=>{
  const partial={CLOUDFLARE_ACCOUNT_ID:input.CLOUDFLARE_ACCOUNT_ID,AIRA_STAGING_D1_ID:input.AIRA_STAGING_D1_ID};
  const c=deploymentConfig('staging',partial,built,'/aira',{databaseOnly:true});
  assert.deepEqual(c.r2_buckets,[]);assert.equal(c.workers_dev,false);assert.equal(c.preview_urls,false);assert.deepEqual(c.routes,[]);
  for(const flag of ['AUTH_ENABLED','BACKUP_ENABLED','BROWSER_ENABLED','AUTONOMY_ENABLED','BILLING_ENABLED','COMPOSIO_INSTANT_ENABLED','MODEL_ROUTING_ENABLED','FILE_PREVIEW_V1'])assert.equal(c.vars[flag],'false');
  assert.equal(c.d1_databases[0].database_id,input.AIRA_STAGING_D1_ID);
});
test('database-only staging still requires a real isolated D1 database',()=>{
  for(const patch of [{CLOUDFLARE_ACCOUNT_ID:''},{AIRA_STAGING_D1_ID:'00000000-0000-4000-8000-000000000000'},{AIRA_PRODUCTION_D1_ID:input.AIRA_STAGING_D1_ID}])assert.throws(()=>deploymentConfig('staging',{...input,...patch},built,'/aira',{databaseOnly:true}));
});
test('database-only mode cannot bypass the complete production storage configuration',()=>{
  assert.throws(()=>deploymentConfig('production',{},built,'/aira',{databaseOnly:true}),/limited to private staging/);
  assert.throws(()=>deploymentConfig('staging',{CLOUDFLARE_ACCOUNT_ID:input.CLOUDFLARE_ACCOUNT_ID,AIRA_STAGING_D1_ID:input.AIRA_STAGING_D1_ID},built));
});

test('public production routing and queues are explicit and isolated',()=>{const c=deploymentConfig('production',{...input,AIRA_PRODUCTION_D1_ID:'22345678-1234-4234-8234-123456789abc',AIRA_PRODUCTION_FILES_BUCKET:'aira-production-files',AIRA_PRODUCTION_BACKUPS_BUCKET:'aira-production-backups',AIRA_PRODUCTION_PUBLIC_ZONE_ID:'a'.repeat(32),AIRA_PRODUCTION_WORK_QUEUE:'braand-work-production',AIRA_PRODUCTION_WORK_DEAD_LETTER_QUEUE:'braand-work-production-failed'},built,'/aira');assert.deepEqual(c.routes,[{pattern:'braand.fun/*',zone_id:'a'.repeat(32)}]);assert.equal(c.queues.producers[0].binding,'WORK_QUEUE');assert.equal(c.queues.consumers[0].max_retries,3);assert.equal(c.vars.WORK_ENABLED,'false');});
