import test from 'node:test';
import assert from 'node:assert/strict';
import {toolResultResources} from '../lib/tool-resources.ts';
const result={id:'project',workspace_id:'workspace',kind:'deliverable',title:'Sources',status:'draft',version:1,created_at:1,updated_at:1,data:{format:'source-project'}};
const file={...result,id:'zip',kind:'file',status:'ready',data:{mime:'application/zip'}};
test('native artifact receipts surface the deliverable and its file immediately',()=>{assert.deepEqual(toolResultResources({...result,file},'workspace'),[ {...result,file},file]);});
test('malformed and foreign receipts cannot escape the selected workspace',()=>{
 for(const value of [null,{},[],{...result,workspace_id:'foreign'},{...result,version:NaN}])assert.deepEqual(toolResultResources(value,'workspace'),[]);
 assert.deepEqual(toolResultResources(result,undefined),[]);assert.equal(toolResultResources({...result,file:{...file,workspace_id:'foreign'}},'workspace').length,1);
});
test('only native envelopes attach files, and existing ordinary receipts retain their behavior',()=>{
 const ordinary={...result,data:{format:'markdown'},file};assert.deepEqual(toolResultResources(ordinary,'workspace'),[ordinary]);assert.equal(toolResultResources({...result,file:{...file,id:result.id}},'workspace').length,1);assert.deepEqual(toolResultResources({reused:true,originalResult:result},'workspace'),[]);
});
