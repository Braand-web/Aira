import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateSocialManifest,verifySocialSnapshot} from '../scripts/import-social-skills.mjs';

const manifest=JSON.parse(await readFile(new URL('../skills/vendor/social/manifest.json',import.meta.url),'utf8'));
const changed=mutate=>{const copy=structuredClone(manifest);mutate(copy);return copy;};

test('social snapshot verifies pinned bytes offline and importing its validator performs no download',async()=>{
 assert.equal(validateSocialManifest(manifest),manifest);
 assert.deepEqual(await verifySocialSnapshot(),manifest);
});

test('social snapshot rejects omitted, duplicate, external and traversing source paths',()=>{
 for(const invalid of [
  null,{},
  changed(copy=>{copy.files=[];}),
  changed(copy=>{copy.files.pop();}),
  changed(copy=>{copy.files[1]=copy.files[0];}),
  changed(copy=>{copy.files[0].path='../LICENSE';}),
  changed(copy=>{copy.files[0].sourceUrl='https://outside.invalid/LICENSE';}),
  changed(copy=>{copy.files[0].extra='unreviewed';}),
 ])assert.throws(()=>validateSocialManifest(invalid));
});

test('social snapshot cannot redefine its reviewed provenance, Git blobs, sizes or selection',()=>{
 for(const key of ['repository','commit','commitDate','license'])assert.throws(()=>validateSocialManifest(changed(copy=>{copy.source[key]='unreviewed';})));
 for(const key of ['sourcePath','commit','gitBlobSha','bytes','sha256'])assert.throws(()=>validateSocialManifest(changed(copy=>{copy.files[0][key]=key==='bytes'?1:'invalid';})));
 assert.throws(()=>validateSocialManifest(changed(copy=>{copy.selection.skills=[];})));
 assert.throws(()=>validateSocialManifest(changed(copy=>{copy.limitations=[];})));
 assert.throws(()=>validateSocialManifest(changed(copy=>{copy.totals.files=0;})));
 assert.throws(()=>validateSocialManifest(changed(copy=>{copy.files[0].sha256='0'.repeat(64);})), 'A syntactically valid digest cannot replace the reviewed digest');
});
