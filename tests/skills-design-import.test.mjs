import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDesignManifest,verifyDesignSnapshot} from '../scripts/import-design-skill.mjs';

const manifest=JSON.parse(await readFile(new URL('../skills/vendor/anthropic/frontend-design/manifest.json',import.meta.url),'utf8'));
const changed=mutate=>{const copy=structuredClone(manifest);mutate(copy);return copy;};

test('design verification checks the complete reviewed snapshot without executing import on module load',async()=>{
 assert.equal(validateDesignManifest(manifest),manifest);
 assert.deepEqual(await verifyDesignSnapshot(),manifest);
});

test('design verification rejects omitted, duplicate and unexpected source files',()=>{
 for(const invalid of [
  changed(copy=>{copy.files=[];}),
  changed(copy=>{copy.files.pop();}),
  changed(copy=>{copy.files[1]=copy.files[0];}),
  changed(copy=>{copy.files.push(copy.files[0]);}),
  changed(copy=>{copy.files[0].path='../SKILL.md';}),
  changed(copy=>{copy.files[0].extra='unreviewed';}),
  changed(copy=>{copy.extra='unreviewed';}),
 ])assert.throws(()=>validateDesignManifest(invalid));
});

test('design verification rejects changed provenance and self-declared integrity',()=>{
 for(const key of ['repository','commit','license'])assert.throws(()=>validateDesignManifest(changed(copy=>{copy[key]='unreviewed';})));
 for(const key of ['sourcePath','url','bytes','sha256'])assert.throws(()=>validateDesignManifest(changed(copy=>{copy.files[0][key]=key==='bytes'?1:'unreviewed';})));
});
