// Exercise the installed Composio SDK's real wire contract with intercepted fetch; no real network.
import assert from 'node:assert/strict';
import {Composio,ComposioToolInputRequiredError} from '@composio/core';
import {AnthropicProvider} from '@composio/anthropic';

const requests=[];
let executionResponse='completed',executionHttpStatus=200;
const skill={primary_tool_slugs:['METAADS_GET_AD_ACCOUNTS'],recommended_plan_steps:['Read accounts before insights'],known_pitfalls:['Use an ad account ID'],extra:'Skill text '.repeat(2000)};
const wireConfig={user_id:'aira_fixture',instant:false,workbench:{enable:false},proxy_execute:{enable:false},manage_connections:{enabled:false},preload:{tools:[]}};
const wireSession={session_id:'session_fixture',mcp:{type:'http',url:'https://backend.composio.dev/mcp/session_fixture'},config:wireConfig,config_version:1};
const savedFetch=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url),method=init?.method||(input instanceof Request?input.method:'GET');
 assert.equal(url.origin,'https://backend.composio.dev','SDK must not call an unexpected endpoint');
 const body=init?.body?JSON.parse(String(init.body)):undefined;requests.push({path:url.pathname,method,body});
 if(url.pathname.endsWith('/tool_router/session')&&method==='POST')return Response.json(wireSession);
 if(url.pathname.endsWith('/tool_router/session/session_fixture')&&method==='GET')return Response.json(wireSession);
 if(url.pathname.endsWith('/session_fixture/toolkits'))return Response.json({items:[{slug:'metaads',name:'Meta Ads',is_no_auth:false,meta:{logo:'https://logos.composio.dev/metaads'},connected_account:{id:'ca_fixture',status:'ACTIVE',auth_config:{id:'ac_fixture',auth_scheme:'OAUTH2',is_composio_managed:false}}}],next_cursor:'next_fixture',total_pages:2});
 if(url.pathname.endsWith('/session_fixture/execute_meta'))return Response.json({result_type:'completed',data:{results:[skill],tool_schemas:{}},error:null,log_id:'log_meta_fixture'});
 if(url.pathname.endsWith('/session_fixture/execute')){
  if(executionHttpStatus!==200)return Response.json({message:'Simulated transient error'}, {status:executionHttpStatus});
  if(executionResponse==='input_required')return Response.json({result_type:'input_required',input_requests:{request_fixture:{type:'elicitation',mode:'form',message:'Approve this exact tool',requested_schema:{type:'object',properties:{decision:{type:'string',enum:['approve','deny']}}}}},request_state:'state_fixture'});
  return Response.json({result_type:executionResponse,data:{records:[{id:'act_fixture'}]},error:executionResponse==='failed'?'Simulated provider refusal':null,log_id:'log_execute_fixture',instant_charge:{amount:'0.010001',currency:'USD',charged_by:'composio'}});
 }
 throw new Error('Unrecognized SDK wire endpoint: '+url.pathname);
};
let checks=0;
async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
try{
 const client=new Composio({apiKey:'fixture_project_key',provider:new AnthropicProvider(),allowTracking:false,logLevel:'silent'});
 let session;
 await check('Actual SDK sends explicit Instant/sandbox/proxy denial with stable user scope',async()=>{
  session=await client.sessions.create('aira_fixture',{instant:false,sandbox:{enable:false},proxyExecute:false,manageConnections:false});
  const body=requests.at(-1).body;assert.equal(body.user_id,'aira_fixture');assert.equal(body.instant,false);assert.deepEqual(body.workbench,{enable:false});assert.deepEqual(body.proxy_execute,{enable:false});assert.equal(session.config.instant,false);
 });
 await check('Actual SDK restores session config and maps API next_cursor to cursor',async()=>{
  session=await client.sessions.use(session.sessionId);assert.equal(session.config.user_id,'aira_fixture');
  const result=await session.toolkits({limit:30});assert.equal(result.cursor,'next_fixture');assert.equal(result.nextCursor,undefined);assert.equal(result.items[0].connection.connectedAccount.id,'ca_fixture');assert.equal(result.items[0].connection.isActive,true);
 });
 await check('Actual SDK preserves SEARCH skill fields and accepts native meta execution',async()=>{
  const result=await session.executeMeta('COMPOSIO_SEARCH_TOOLS',{queries:[{use_case:'Read Meta accounts and insights'}]});assert.deepEqual(result.data.results[0],skill);assert.equal(result.resultType,'completed');assert.equal(result.logId,'log_meta_fixture');
 });
 await check('Actual SDK sends account separately and returns exact explicit Instant charge',async()=>{
  const result=await session.execute('METAADS_GET_AD_ACCOUNTS',{fields:['id']},{account:'ca_fixture'});assert.deepEqual(requests.at(-1).body,{tool_slug:'METAADS_GET_AD_ACCOUNTS',arguments:{fields:['id']},account:'ca_fixture'});assert.deepEqual(result.instantCharge,{amount:'0.010001',currency:'USD',charged_by:'composio'});
 });
 await check('Actual SDK marks provider refusals as failed even when HTTP transport succeeds',async()=>{
  executionResponse='failed';const result=await session.execute('METAADS_GET_AD_ACCOUNTS',{});assert.equal(result.resultType,'failed');executionResponse='completed';
 });
 await check('Actual SDK never retries tool execution on HTTP 429 or 503',async()=>{
  for(const status of [429,503]){const before=requests.length;executionHttpStatus=status;await assert.rejects(()=>session.execute('METAADS_CREATE_CAMPAIGN',{name:'Fixture'}));assert.equal(requests.length,before+1);}
  executionHttpStatus=200;
 });
 await check('Actual SDK never retries meta execution on uncertain transport failure',async()=>{
  const fetchFixture=globalThis.fetch;let attempts=0;globalThis.fetch=async()=>{attempts++;throw new TypeError('Simulated lost response');};
  try{await assert.rejects(()=>session.executeMeta('COMPOSIO_SEARCH_TOOLS',{}));assert.equal(attempts,1);}finally{globalThis.fetch=fetchFixture;}
 });
 await check('Actual SDK raises typed input-required error instead of executing approval implicitly',async()=>{
  executionResponse='input_required';let error;try{await session.execute('METAADS_CREATE_CAMPAIGN',{name:'Fixture'});}catch(caught){error=caught;}
  assert.ok(error instanceof ComposioToolInputRequiredError);assert.equal(error.requestState,'state_fixture');assert.equal(error.inputRequests.request_fixture.message,'Approve this exact tool');executionResponse='completed';
 });
 console.log(`${checks} installed Composio SDK contract checks passed. All HTTP requests were intercepted; no external account or paid call.`);
}finally{globalThis.fetch=savedFetch;}
