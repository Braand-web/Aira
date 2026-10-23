// Real orchestrator, tool policy and SQLite persistence. No provider or external action.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const project=path.resolve(import.meta.dirname,'..'),runtime=process.env.AIRA_TOOLCHAIN||path.join(project,'node_modules'),{build}=createRequire(path.join(runtime,'package.json'))('esbuild');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync(path.join(project,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(path.join(project,'drizzle',file),'utf8'));
function statement(query,args=[]){return {bind(...v){return statement(query,v);},async first(column){const row=sql.prepare(query).get(...args);return column?row?.[column]??null:row??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return this._run();},_run(){const result=sql.prepare(query).run(...args);return {meta:{changes:Number(result.changes)}};}};}
const DB={prepare:q=>statement(q),async batch(ss){sql.exec('BEGIN');try{const r=ss.map(s=>s._run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const fixture={env:{DB},headers:new Headers({'oai-authenticated-user-id':'agent-routing-owner','oai-authenticated-user-email':'owner@test.invalid'}),requests:[],responses:[],external:[],events:[],beforeTools:0};globalThis.__briefPauseTest=fixture;
const out=path.join(project,'.local-build','brief-pause-test.mjs');mkdirSync(path.dirname(out),{recursive:true});
await build({stdin:{contents:`export * as agent from ${JSON.stringify(path.join(project,'lib/agent.ts').replaceAll('\\','/'))};export * as server from ${JSON.stringify(path.join(project,'lib/server.ts').replaceAll('\\','/'))};`,resolveDir:project,loader:'ts'},outfile:out,bundle:true,platform:'node',format:'esm',nodePaths:[runtime],plugins:[{name:'agent-routing-isolation',setup(b){

 b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},a=>({path:a.path,namespace:'bindings'}));
 b.onLoad({filter:/.*/,namespace:'bindings'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__briefPauseTest.env;':a.path==='next/headers'?'export async function headers(){return globalThis.__briefPauseTest.headers;}':'export function redirect(){throw Error("Unexpected redirect");}'}));
 b.onResolve({filter:/^\.\/(metering|composio|browser|browser-agent|providers)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:{
  './metering':`export async function meteredMessage(budget,role,body,signal,routing){const f=globalThis.__briefPauseTest;f.requests.push({budget,role,body:structuredClone(body),routing:structuredClone(routing)});if(signal.aborted)throw Error('Aborted');const response=f.responses.shift();if(response===undefined)throw Error('Unexpected model request');return new Response(response,{headers:{'content-type':'text/event-stream'}});}`,
  './composio':`export async function connectorAgentTools(){return [];}export async function executeConnectorAgentTool(){globalThis.__briefPauseTest.external.push('connector');throw Error('External connectors forbidden in routing tests');}`,
  './providers':`export function falCatalog(){return [];}export function mediaRoute(){throw Error('Media generation forbidden in routing tests');}export async function metaGet(){globalThis.__briefPauseTest.external.push('meta_read');return {data:[]};}`,
  './browser':`export const browserService={async create(){globalThis.__briefPauseTest.external.push('browser');throw Error('Browser forbidden in routing tests');}};`,
  './browser-agent':`export async function runBrowserAgentTurn(){throw Error('Unexpected browser runner');}`,
 }[a.path]}));
}}]});
const {agent,server}=await import(pathToFileURL(out).href),who=await server.identity(new Request('https://aira.test/api/chat'));
globalThis.fetch=async()=>{throw Error('Network forbidden in orchestrator routing tests');};
const emit=async(type,data)=>{fixture.events.push({type,data});},signal=()=>new AbortController().signal;
function stream(blocks){return [{type:'message_start',message:{model:'fixture',usage:{}}},...blocks.flatMap((block,index)=>block.type==='tool_use'?[{type:'content_block_start',index,content_block:{...block,input:{}}},{type:'content_block_delta',index,delta:{type:'input_json_delta',partial_json:JSON.stringify(block.input)}},{type:'content_block_stop',index}]:[{type:'content_block_start',index,content_block:{...block,text:''}},{type:'content_block_delta',index,delta:{type:'text_delta',text:block.text||''}},{type:'content_block_stop',index}]),{type:'message_stop'}].map(event=>'event: '+event.type+'\ndata: '+JSON.stringify(event)+'\n\n').join('');}
const text=value=>stream([{type:'text',text:value}]);
async function setup(){sql.prepare("UPDATE runs SET status='partial' WHERE status='streaming'").run();fixture.requests=[];fixture.responses=[];fixture.external=[];fixture.events=[];fixture.beforeTools=0;const conversation=await server.createResource(who.tenant,'conversation','Chat local',{},'saved'),runId=crypto.randomUUID(),now=Date.now();sql.prepare("INSERT INTO runs(id,workspace_id,conversation_id,status,created_at,updated_at) VALUES (?,?,?,'streaming',?,?)").run(runId,who.tenant,conversation.id,now,now);sql.prepare("INSERT INTO messages(id,workspace_id,conversation_id,role,content,created_at) VALUES (?,?,?,'user',?,?)").run(crypto.randomUUID(),who.tenant,conversation.id,JSON.stringify([{type:'text',text:'Contexte privé de cet espace'}]),now);const budget={who,runId,holdId:'shared-'+runId,limit:5000,rate:{model:'fixture'},beforeTool:async()=>{fixture.beforeTools++;}};return {conversationId:conversation.id,runId,budget};}
const run=execution=>agent.runAgent(who.tenant,execution.conversationId,execution.runId,emit,signal(),execution.budget);
const specialist=(execution,role)=>agent.runSpecialist(who.tenant,execution.runId,{role,task:'Travail encadré '+role,context:'Faits fournis par cet espace'},emit,signal(),execution.budget);
let count=0;async function check(name,fn){await fn();count++;console.log('PASS '+name);}
const questionnaire={title:'Précisons votre création',questions:[{id:'objective',q:'Quel est votre objectif ?',type:'radio',options:['Présenter le produit','Trouver des clients']}]};
const ask=(id='brief-1',input=questionnaire)=>({type:'tool_use',id,name:'ask_brief_questions',input});
const savedMessages=execution=>sql.prepare('SELECT role,content FROM messages WHERE conversation_id=? ORDER BY rowid').all(execution.conversationId).map(row=>({...row,content:JSON.parse(row.content)}));
const resourcesCount=()=>sql.prepare('SELECT COUNT(*) n FROM resources').get().n;
await check('pure tool validates bounded questions without creating resources or making external calls',async()=>{
 const before=resourcesCount();assert.deepEqual(await agent.executeTool(who.tenant,'ask_brief_questions',questionnaire),{kind:'brief_questions',...questionnaire});
 assert.equal(resourcesCount(),before);assert.equal(fixture.external.length,0);
 await assert.rejects(()=>agent.executeTool(who.tenant,'ask_brief_questions',{...questionnaire,questions:[]}));
});
await check('a clarification blocks the whole batch regardless of order and pauses after one persisted model turn',async()=>{
 const companions=[
  {type:'tool_use',id:'read',name:'search_workspace',input:{kind:'knowledge'}},
  {type:'tool_use',id:'write',name:'save_knowledge',input:{title:'Must not exist',content:'No effect',source:'fixture'}},
  {type:'tool_use',id:'specialist',name:'delegate_specialist',input:{role:'creative',task:'Not delegated',context:'Fixture'}},
  {type:'tool_use',id:'connector',name:'aira_connector_action',input:{}},
  {type:'tool_use',id:'browser',name:'browser_plan',input:{objective:'Not started',allowedDomains:['example.com'],maxCredits:10}},
 ];
 for(const position of [0,2,companions.length]){
  const execution=await setup(),before=resourcesCount(),calls=[...companions.toSpliced(position,0,ask()),ask('second-brief')];fixture.responses=[stream(calls)];
  await run(execution);assert.equal(fixture.requests.length,1);assert.equal(fixture.beforeTools,1);assert.equal(resourcesCount(),before);assert.deepEqual(fixture.external,[]);
  const messages=savedMessages(execution),results=messages.at(-1).content;
  assert.equal(messages.length,3);assert.deepEqual(messages[1].content,calls);assert.deepEqual(results.map(result=>result.tool_use_id),calls.map(call=>call.id));
  assert.deepEqual(JSON.parse(results.find(result=>result.tool_use_id==='brief-1').content),{kind:'brief_questions',...questionnaire});
  assert.ok(results.filter(result=>result.tool_use_id!=='brief-1').every(result=>result.is_error===true));
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM audit WHERE target=? AND action='tool.ask_brief_questions'").get(execution.runId).n,1);
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM audit WHERE target=? AND action='tool.blocked_for_brief'").get(execution.runId).n,companions.length+1);
  assert.equal(fixture.events.filter(event=>event.type==='tool_result'&&!event.data.error).length,1);
 }
});
await check('invalid first question blocks adjacent tools and a later card, then permits a corrective model response',async()=>{
 const execution=await setup(),before=resourcesCount(),calls=[{type:'tool_use',id:'early-write',name:'save_knowledge',input:{title:'Blocked',content:'No mutation',source:'fixture'}},ask('invalid',{...questionnaire,questions:[]}),ask('valid-but-second')];
 fixture.responses=[stream(calls),text('Pourriez-vous préciser votre objectif ?')];await run(execution);
 assert.equal(fixture.requests.length,2);assert.equal(fixture.beforeTools,1);assert.equal(resourcesCount(),before);assert.deepEqual(fixture.external,[]);
 assert.ok(fixture.requests[1].body.messages.at(-1).content.every(result=>result.is_error));
 assert.equal(fixture.events.some(event=>event.type==='tool_result'&&event.data.result?.kind==='brief_questions'),false);
});
await check('autonomous mode exposes clarification while continuing to deny external actions',async()=>{
 const execution=await setup(),before=resourcesCount();fixture.responses=[stream([ask()])];
 await agent.runAgent(who.tenant,execution.conversationId,execution.runId,emit,signal(),execution.budget,'autonomous');
 assert.equal(fixture.requests.length,1);assert.equal(fixture.beforeTools,1);assert.equal(resourcesCount(),before);assert.deepEqual(fixture.external,[]);
 assert.deepEqual(fixture.requests[0].body.tools.map(tool=>tool.name),['ask_brief_questions','search_workspace','plan_mission','read_meta']);
 assert.match(fixture.requests[0].body.system[0].text,/sans autoriser une génération/);
});
await check('the next user turn retains every original model block and paired tool result',async()=>{
 const execution=await setup(),calls=[{type:'redacted_thinking',data:'opaque-native-block'},ask(),{type:'tool_use',id:'blocked-read',name:'read_meta',input:{resource:'accounts'}}];
 fixture.responses=[stream(calls)];await run(execution);
 const persisted=savedMessages(execution),assistant=persisted[1].content,results=persisted[2].content;
 assert.equal(assistant[0].data,'opaque-native-block');assert.equal(results.length,2);assert.equal(results[1].is_error,true);
 // Both statements in an atomic tool batch can share the same millisecond.
 sql.prepare('UPDATE messages SET created_at=? WHERE conversation_id=?').run(Date.now(),execution.conversationId);
 fixture.responses=[text('Merci pour ces précisions.')];await run(execution);
 assert.deepEqual(fixture.requests[1].body.messages.slice(1),[{role:'assistant',content:assistant},{role:'user',content:results}]);
 assert.equal(fixture.requests.length,2);assert.equal(fixture.external.length,0);
});
await check('disconnecting during event delivery leaves paired protocol and audit entries persisted',async()=>{
 const execution=await setup();fixture.responses=[stream([ask()])];
 await assert.rejects(()=>agent.runAgent(who.tenant,execution.conversationId,execution.runId,async(type)=>{if(type==='assistant_message')throw Error('Client disconnected');},signal(),execution.budget),/disconnected/);
 const messages=savedMessages(execution);assert.equal(messages.length,3);
 assert.equal(messages[1].content[0].id,messages[2].content[0].tool_use_id);
 assert.equal(sql.prepare("SELECT COUNT(*) n FROM audit WHERE target=? AND action='tool.ask_brief_questions'").get(execution.runId).n,1);
});
await check('budget guards still run before a clarification is persisted or delivered',async()=>{
 const execution=await setup();fixture.responses=[stream([ask()])];execution.budget.beforeTool=async()=>{throw Error('Budget refused');};
 await assert.rejects(()=>run(execution),/Budget refused/);assert.equal(savedMessages(execution).length,1);
 assert.equal(fixture.events.some(event=>event.type==='assistant_message'),false);assert.equal(fixture.external.length,0);
});
await check('specialists neither receive nor gain access to clarification tools',async()=>{
 const execution=await setup(),before=resourcesCount();fixture.responses=[stream([ask()])];
 await assert.rejects(()=>specialist(execution,'creative'),/Outil interdit/);
 assert.equal(fixture.requests.length,1);assert.equal(fixture.requests[0].body.tools.some(tool=>tool.name==='ask_brief_questions'),false);
 assert.equal(resourcesCount(),before+1);assert.equal(fixture.external.length,0);
});
console.log(count+' brief pause integration checks passed; no external model or provider calls.');
