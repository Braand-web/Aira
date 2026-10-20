import test from 'node:test';
import assert from 'node:assert/strict';
import {modelBlockSchema,modelEventSchema,modelBlockStartSchema,modelBlockDeltaSchema,isModelToolUse,modelRateSchema} from '../lib/model-protocol.ts';

test('model protocol keeps signed thinking, citations and unfamiliar provider fields intact',()=>{
 const block={type:'thinking',thinking:'fixture',signature:'signed-fixture',provider_metadata:{reference:'fixture'},citations:[{type:'test',id:'source'}]};
 assert.deepEqual(modelBlockSchema.parse(block),block);
 const redacted={type:'redacted_thinking',data:'opaque-provider-token'};assert.deepEqual(modelBlockSchema.parse(redacted),redacted);
 const event={type:'message_delta',usage:{output_tokens:12},future_field:{value:true}};assert.deepEqual(modelEventSchema.parse(event),event);
});
test('tool identity and arguments survive validation, malformed tool blocks are refused',()=>{
 const block=modelBlockSchema.parse({type:'tool_use',id:'tool-1',name:'search_workspace',input:{kind:'knowledge'},cache_control:{type:'ephemeral'}});
 assert.equal(isModelToolUse(block),true);assert.deepEqual(block.input,{kind:'knowledge'});assert.deepEqual(block.cache_control,{type:'ephemeral'});
 assert.equal(modelBlockSchema.safeParse({type:'tool_use',input:{}}).success,false);
});
test('stream block indices and known delta payloads require valid values',()=>{
 assert.equal(modelBlockStartSchema.safeParse({index:-1,content_block:{type:'text',text:''}}).success,false);
 for(const type of ['text_delta','input_json_delta','thinking_delta','signature_delta'])assert.equal(modelBlockDeltaSchema.safeParse({index:0,delta:{type}}).success,false);
 assert.deepEqual(modelBlockDeltaSchema.parse({index:1,delta:{type:'future_delta',opaque:'value'}}).delta,{type:'future_delta',opaque:'value'});
});
test('model price validation rejects non-finite and negative configured prices',()=>{
 const rate={model:'fixture',input:1,output:1,cacheWrite:1,cacheRead:1,usdXaf:600,overheadXaf:0,verifiedAt:new Date().toISOString()};
 assert.equal(modelRateSchema.safeParse(rate).success,true);
 for(const value of [NaN,Infinity,-1])assert.equal(modelRateSchema.safeParse({...rate,input:value}).success,false);
});
