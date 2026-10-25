// Reuse the live Worker and its bindings. Secrets and variables remain remote.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const built=JSON.parse(await readFile(path.join(root,'dist/server/wrangler.json'),'utf8'));
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!/^[a-f0-9]{32}$/.test(account||'')||!process.env.CLOUDFLARE_API_TOKEN)throw new Error('Cloudflare deployment credentials are missing.');
const script='aira-production';
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${script}/settings`,{headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`}});
const body=await response.json();if(!response.ok||!body.success)throw new Error('Unable to read the current production settings.');
const bindings=body.result.bindings;
const binding=name=>{const result=bindings.find(item=>item.name===name);if(!result)throw new Error(`Production binding ${name} is missing.`);return result;};
const database=binding('DB'),files=binding('BUCKET'),backups=binding('BACKUP_BUCKET'),browserSessions=binding('BROWSER_SESSIONS');
if(database.type!=='d1'||files.type!=='r2_bucket'||backups.type!=='r2_bucket'||browserSessions.type!=='durable_object_namespace')throw new Error('Unexpected production binding types.');
const config={name:script,account_id:account,main:path.join(root,'dist/server/index.js'),no_bundle:true,
 compatibility_date:built.compatibility_date,compatibility_flags:built.compatibility_flags,rules:built.rules,
 assets:{directory:path.join(root,'dist/client')},workers_dev:false,preview_urls:false,keep_vars:true,
 routes:[{pattern:'braand.fun/*',zone_id:'736e266fe4cc31e9ae5848c47e39ef2c'}],
 d1_databases:[{binding:'DB',database_id:database.id,database_name:'aira-production',migrations_dir:path.join(root,'drizzle')}],
 r2_buckets:[{binding:'BUCKET',bucket_name:files.bucket_name},{binding:'BACKUP_BUCKET',bucket_name:backups.bucket_name}],
 durable_objects:{bindings:[{name:'BROWSER_SESSIONS',class_name:browserSessions.class_name||'BrowserSession'}]},
 migrations:built.migrations,browser:built.browser,triggers:{crons:['*/5 * * * *']},observability:{enabled:false}};
// In particular, never replace live vars with the closed defaults from the base generator.
await mkdir(path.join(root,'.wrangler/deploy'),{recursive:true});
await writeFile(path.join(root,'.wrangler/deploy/production-live.json'),JSON.stringify(config,null,2)+'\n');
console.log('Prepared existing aira-production Worker; live variables and secrets preserved.');
