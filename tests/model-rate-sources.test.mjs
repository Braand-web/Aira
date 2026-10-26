import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBEACReference,refreshOpenRouterRate} from '../lib/model-rate-sources.mjs';
const now=Date.parse('2026-10-26T02:00:00Z');
const html=(date='23/10/2026',buy='582.5503',sell='587.5463')=>`USD/XAF</span></div></div><div id="middle"> ${buy} </div><div id="right"> ${sell} </div><p>Date de valeur : ${date}</p>`;
const previous={model:'anthropic/claude-haiku-5.5',fundingFeeBps:0,overheadXaf:0,verifiedAt:'2026-10-24T00:00:00Z'};
const model=()=>({id:previous.model,supported_parameters:['tools'],context_length:1000000,top_provider:{max_completion_tokens:128000},pricing:{prompt:'0.0000001',completion:'0.0000005',input_cache_read:'0.00000001',input_cache_write:'0.000000125',input_cache_write_1h:'0.0000002',overrides:[{min_prompt_tokens:100000,prompt:'0.0000005'}]}});
test('weekend verification retains the official FX value date and uses the sell reference',()=>{
 assert.deepEqual(parseBEACReference(html(),now),{usdXaf:587.5463,fxSource:'https://www.beac.int/',fxValueDate:'2026-10-23',conversionBasis:'beac_sell_reference'});
 for(const input of [html('27/10/2026'),html('01/10/2026'),html('31/09/2026'),html('23/10/2026','600','587'),html('23/10/2026','0','587'),'USD 587.5463'])assert.throws(()=>parseBEACReference(input,now));
});
test('supplier units become per-million prices without changing fees or admitting a more expensive tier',()=>{
 const updated=refreshOpenRouterRate(model(),previous,{maxInputTokens:120000,maxOutputTokens:8192},parseBEACReference(html(),now),now);
 assert.equal(updated.maxInputTokens,99999);assert.equal(updated.maxOutputTokens,8192);
 for(const [key,value] of Object.entries({input:.1,output:.5,cacheRead:.01,cacheWrite:.125,cacheWriteHour:.2,fundingFeeBps:0,overheadXaf:0,usdXaf:587.5463}))assert.equal(updated.rate[key],value);
 assert.equal(updated.rate.verifiedAt,new Date(now).toISOString());assert.equal(previous.verifiedAt,'2026-10-24T00:00:00Z');
 const bounded=refreshOpenRouterRate(model(),previous,{maxInputTokens:90000,maxOutputTokens:4096},parseBEACReference(html(),now),now);assert.equal(bounded.maxInputTokens,90000);assert.equal(bounded.maxOutputTokens,4096);
});
test('incomplete prices, changed model IDs, unavailable tools and new fixed request fees fail closed',()=>{
 for(const edit of [m=>delete m.pricing.prompt,m=>m.pricing.prompt='-1',m=>m.pricing.completion='',m=>delete m.pricing.input_cache_write_1h,m=>m.id='another/model',m=>m.supported_parameters=[],m=>m.pricing.overrides=[{min_prompt_tokens:0}],m=>m.pricing.request='0.01']){
  const changed=model();edit(changed);assert.throws(()=>refreshOpenRouterRate(changed,previous,{maxInputTokens:90000,maxOutputTokens:8192},parseBEACReference(html(),now),now));
 }
});
