// Real campaign service + resource PATCH handler. Storage/auth fixtures forbid remote actions.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {campaignBrief} from '../lib/campaign-preparation.mjs';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'.tmp','campaign-route-test.mjs');await mkdir(path.dirname(output),{recursive:true});
const base={id:'campaign',kind:'campaign',title:'Campagne',workspace_id:'space',status:'draft',version:1,created_at:1,updated_at:1,data:{objective:'leads',privateContext:'keep'}};
const fixture={resources:new Map([['campaign',structuredClone(base)],['media',{...base,id:'media',kind:'media',status:'ready'}],['page',{...base,id:'page',kind:'page'}],['foreign',{...base,id:'foreign',kind:'media',status:'ready',workspace_id:'other'}]]),role:'editor',updates:[],audit:[]};
globalThis.__campaignTest=fixture;
await build({entryPoints:[path.join(root,'app/api/resources/[id]/route.ts')],outfile:output,bundle:true,format:'esm',platform:'node',plugins:[{name:'campaign-fixtures',setup(builder){
 builder.onResolve({filter:/^(?:@\/lib\/server|\.\/server)$/},()=>({path:'server',namespace:'campaign-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'campaign-fixture'},()=>({loader:'js',contents:`
 const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
 export async function identity(){if(globalThis.__campaignTest.role==='reader')fail('Lecture seule',403);return {tenant:'space',user:{userId:'editor'}};}
 export async function getResource(tenant,id){const resource=globalThis.__campaignTest.resources.get(id);if(!resource||resource.workspace_id!==tenant)fail('Introuvable',404);return structuredClone(resource);}
 export const getClientResource=getResource;
 export async function updateResource(tenant,id,version,patch){const current=await getResource(tenant,id);if(version!==current.version)fail('Version modifiée',409);globalThis.__campaignTest.updates.push({tenant,id,version,patch});const next={...current,...patch,version:version+1};globalThis.__campaignTest.resources.set(id,next);return next;}
 export async function auditLog(...args){globalThis.__campaignTest.audit.push(args);}export function db(){throw Error('Unexpected database operation');}
 export function failure(error){return Response.json({error:error.message},{status:error.status||400});}
 `}));
}}]});
const {PATCH,GET}=await import(pathToFileURL(output).href);
const brief={...campaignBrief(base.data),offer:'Offre',audience:'Public',dailyBudget:100,currency:'XAF',creativeIds:['media'],pageId:'page'};
const patch=(body,id='campaign')=>PATCH(new Request('http://localhost/api/resources/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({id})});
let response=await patch({action:'campaign_brief',version:1,title:'Plan affiné',brief});assert.equal(response.status,200);let saved=await response.json();assert.equal(saved.version,2);assert.equal(saved.status,'draft');assert.equal(saved.title,'Plan affiné');assert.equal(saved.data.privateContext,'keep');assert.equal(saved.data.briefHistory[0].version,1);assert.equal(fixture.audit.length,1);assert.equal(fixture.updates.length,1);
assert.equal((await patch({action:'campaign_brief',version:1,brief})).status,409);assert.equal(fixture.updates.length,1);
assert.equal((await patch({action:'campaign_brief',version:2,brief:{...brief,creativeIds:['foreign']}})).status,404);assert.equal(fixture.updates.length,1);
assert.equal((await patch({action:'campaign_brief',version:2,brief:{...brief,creativeIds:['page']}})).status,409);
assert.equal((await patch({action:'campaign_brief',version:2,brief:{...brief,pageId:'media'}})).status,409);
assert.equal((await patch({action:'campaign_brief',version:2,brief:{...brief,status:'active'}})).status,400);
assert.equal((await patch({action:'campaign_brief',version:2,brief:{...brief,dailyBudget:-1}})).status,400);
assert.equal((await patch({action:'campaign_brief',version:1,brief},'page')).status,400);
fixture.role='reader';assert.equal((await patch({action:'campaign_brief',version:2,brief})).status,403);assert.equal(fixture.updates.length,1);
fixture.role='editor';fixture.resources.get('campaign').status='active';assert.equal((await patch({action:'campaign_brief',version:2,brief})).status,409);assert.equal(fixture.updates.length,1);
console.log('PASS campaign brief PATCH: versioned draft-only updates, preserved context/history, tenant-owned references, role denial and no advertising execution');

fixture.role='editor';fixture.resources.set('private-action',{...base,id:'private-action',kind:'connector_action',data:{requester:'another-user'}});fixture.resources.set('own-action',{...base,id:'own-action',kind:'connector_action',data:{requester:'editor'}});const get=id=>GET(new Request('http://localhost/api/resources/'+id),{params:Promise.resolve({id})});assert.equal((await get('private-action')).status,404);assert.equal((await get('own-action')).status,200);console.log('PASS generic resource HTTP reads enforce private connector ownership');
