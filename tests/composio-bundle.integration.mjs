// Build first. Inspect the actual browser artifacts, never print secret values.
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const scripts=files(path.join(root,'dist/client')).filter(file=>/\.(js|mjs)$/.test(file));
assert.ok(scripts.length>0,'Run npm run build before inspecting browser bundles.');
const sources=scripts.map(file=>readFileSync(file,'utf8')).join('\n');
for(const marker of ['COMPOSIO_API_KEY','@composio/core','fixture_project_key_not_a_real_secret'])assert.equal(sources.includes(marker),false,'Server credentials/SDK must not be emitted into browser JavaScript.');
console.log('PASS Built browser JavaScript contains neither Composio server configuration, SDK nor test credential.');
assert.ok(sources.includes('/api/connectors/'),'Built UI must use the authenticated Aïra API.');
console.log('PASS Connector UI calls Aïra routes instead of the Composio API directly.');
