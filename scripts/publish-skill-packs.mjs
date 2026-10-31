// Publish pinned inert objects to the existing private bucket. No provider calls.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const worker=process.argv[process.argv.indexOf('--worker')+1];
if(!process.argv.includes('--apply')||!['aira-staging','aira-production'].includes(worker))throw Error('Explicit --apply --worker aira-staging|aira-production required');
const manifest=JSON.parse(await readFile(path.join(root,'skills/packs/manifest.json'),'utf8'));
const cli=process.env.BRAAND_WRANGLER_CLI||path.join(root,'node_modules/wrangler/bin/wrangler.js');
const auth=spawnSync(process.execPath,['--use-env-proxy',cli,'auth','token','--json'],{encoding:'utf8',env:{...process.env,WRANGLER_WRITE_LOGS:'false',WRANGLER_SEND_METRICS:'false'}});
if(auth.status!==0)throw Error('Cloudflare authentication unavailable');
const {token}=JSON.parse(auth.stdout),account='2ead1748668417f67d184d93a3fd69ec';
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
const settingsResponse=await fetch(base+'/workers/scripts/'+worker+'/settings',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
const settings=await settingsResponse.json();if(!settingsResponse.ok||!settings.success)throw Error('Could not verify target bucket');
const binding=settings.result.bindings.find(binding=>binding.name==='BUCKET'&&binding.type==='r2_bucket');
if(!binding?.bucket_name)throw Error('Existing private bucket binding required');
const bucket=binding.bucket_name;
if(worker==='aira-production'&&bucket!=='aira-production-files'||worker==='aira-staging'&&bucket==='aira-production-files')throw Error('Target bucket isolation failed');
const headers={Authorization:'Bearer '+token,'cf-r2-data-catalog-check':'true'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let cursor=0,verified=0,uploaded=0,reused=0;
const errors=[];
async function processObject(object){
 if(!/^[a-f0-9]{64}$/.test(object.sha256)||object.key!=='skills/packs/v1/'+object.sha256)throw Error('Invalid object key');
 const source=path.resolve(root,object.path);if(!source.startsWith(path.join(root,'skills')+path.sep))throw Error('Object source outside skill corpus');
 const bytes=await readFile(source);if(bytes.length!==object.bytes||sha(bytes)!==object.sha256)throw Error('Local object failed integrity');
 const url=base+'/r2/buckets/'+encodeURIComponent(bucket)+'/objects/'+object.key.split('/').map(encodeURIComponent).join('/');
 const existing=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});
 if(existing.ok){const content=new Uint8Array(await existing.arrayBuffer());if(content.length!==object.bytes||sha(content)!==object.sha256)throw Error('Immutable object differs; do not overwrite');reused++;}
 else if(existing.status===404){
  await existing.arrayBuffer();
  const response=await fetch(url,{method:'PUT',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(bytes.length),'Cache-Control':'private, no-store'},body:bytes,signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Object upload failed '+response.status);await response.arrayBuffer();
  const confirmation=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});if(!confirmation.ok)throw Error('Object confirmation failed');
  const content=new Uint8Array(await confirmation.arrayBuffer());if(content.length!==object.bytes||sha(content)!==object.sha256)throw Error('Uploaded object failed integrity');uploaded++;
 }else throw Error('Object read failed '+existing.status);
 verified++;if(verified%50===0)console.log(JSON.stringify({worker,verified,total:manifest.objects.length,uploaded,reused}));
}
await Promise.all(Array.from({length:4},async()=>{while(!errors.length){const index=cursor++;if(index>=manifest.objects.length)return;try{await processObject(manifest.objects[index]);}catch(error){errors.push({digest:manifest.objects[index].sha256,error:error.message});}}}));
const receipt={at:new Date().toISOString(),worker,bucket,manifest:manifest.digest,verified,total:manifest.objects.length,uploaded,reused,errors};
await mkdir(path.join(root,'.tmp'),{recursive:true});await writeFile(path.join(root,'.tmp/skill-packs-publish-'+worker+'.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));if(errors.length||verified!==manifest.objects.length)throw Error('Publication incomplete; inspect receipt and reconcile immutable objects before continuing');
