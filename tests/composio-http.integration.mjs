// Requires an isolated dev-local server with an empty BRAAND_CONFIG_FILE, never production.
import assert from 'node:assert/strict';
const base=process.env.BRAAND_TEST_URL;
if(!base||!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw new Error('Set BRAAND_TEST_URL to the isolated localhost test server.');
let cookie='';
async function request(endpoint,method='GET',body,origin){
 return fetch(base+endpoint,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual'});
}
assert.equal((await request('/api/connectors/toolkits')).status,401);
console.log('PASS Connector catalogue requires a local authenticated session.');
const login=await request('/auth/sign-in');assert.equal(login.status,302);cookie=login.headers.get('set-cookie').split(';')[0];
const response=await request('/api/connectors/toolkits'),catalogue=await response.json();assert.equal(response.status,200);assert.equal(catalogue.configured,false);assert.deepEqual(catalogue.items,[]);assert.equal(catalogue.nextCursor,null);assert.match(response.headers.get('cache-control'),/private.*no-store/);
console.log('PASS Actual HTTP route reports missing configuration with no invented toolkits or account.');
const authorize=await request('/api/connectors/authorize','POST',{toolkit:'metaads'},base);assert.equal(authorize.status,503);assert.equal((await authorize.json()).code,'composio_not_configured');
console.log('PASS Missing project key blocks OAuth generation without exposing a secret.');
for(const origin of [undefined,'https://attacker.invalid'])assert.equal((await request('/api/connectors/authorize','POST',{toolkit:'metaads'},origin)).status,403);
console.log('PASS Origin validation rejects absent and foreign origins before external access.');
assert.equal((await request('/api/connectors/unknown')).status,404);
console.log('PASS Unknown connector route returns a real 404.');
assert.equal((await request('/app.css')).status,200);
console.log('PASS Isolated local preview serves the connector stylesheet.');
console.log('6 real HTTP checks passed. No external account or provider call.');
