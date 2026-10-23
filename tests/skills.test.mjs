import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createSkillSession,searchSkills,readSkill,skillDiscoveryContext,publicSkillResult} from '../lib/skills/registry.ts';
import {SKILL_POLICY} from '../lib/skills/policy.mjs';

test('reviewed sources and generated lazy catalog reproduce the pinned local bytes',()=>{
 for(const [file,args]of [['import-marketing-skills.mjs',['--verify']],['import-design-skill.mjs',['--verify']],['build-skill-catalog.mjs',['--check']]])execFileSync(process.execPath,['scripts/'+file,...args],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
});
test('discovery is bounded metadata and actual method text is loaded only on explicit read',async()=>{
 const result=searchSkills({query:'rédaction vente'});assert.ok(result.skills.some(skill=>skill.id==='copywriting'));assert.ok(result.skills.length<=SKILL_POLICY.maxSearchResults);assert.equal('content' in result.skills[0],false);
 const discovery=skillDiscoveryContext();assert.ok(discovery.includes('aira-xlsx'));assert.ok(!discovery.includes('Three-Question Gate'));assert.ok(!discovery.includes('frontend-design/SKILL.md'));
 const session=createSkillSession();assert.equal(session.calls,0);const loaded=await readSkill({id:'copywriting'},session);assert.ok(loaded.content.includes('# Copywriting'));assert.equal(session.calls,1);assert.equal(session.chars,loaded.content.length);assert.equal(loaded.provenance.license,'MIT');
});
test('long methods can be reconstructed with explicit bounded chunks without lost characters',async()=>{
 const session=createSkillSession();let offset=0,parts=[],first;
 do{const result=await readSkill({id:'ad-creative',offset},session);first??=result;parts.push(result.content);assert.ok(result.chars<=SKILL_POLICY.maxReadChars);if(result.nextOffset===null){assert.equal(parts.join('').length,result.totalChars);break;}assert.equal(result.truncated,true);assert.ok(result.nextOffset>offset);offset=result.nextOffset;}while(parts.length<SKILL_POLICY.maxReadCalls);
 assert.equal(first.truncated,true);assert.ok(parts.join('').includes('# Ad Creative'));assert.ok(session.chars<=SKILL_POLICY.maxRunChars);
});
test('references are an exact reviewed allowlist and must follow the skill entry',async()=>{
 for(const input of [{id:'../../secret'},{id:'copywriting',reference:'../LICENSE'},{id:'copywriting',reference:'https://outside.invalid/secret'},{id:'unknown'},{id:'copywriting',offset:-1},{id:'copywriting',offset:1e9}])await assert.rejects(()=>readSkill(input,createSkillSession()));
 const session=createSkillSession();const entry=await readSkill({id:'copywriting'},session);assert.ok(entry.references.length>0);
 await assert.rejects(()=>readSkill({id:'copywriting',reference:entry.references[0]},createSkillSession()),error=>error.code==='skill_entry_required');
 const reference=await readSkill({id:'copywriting',reference:entry.references[0]},session);assert.ok(reference.content.length>0);assert.equal(reference.reference,entry.references[0]);
});
test('parallel reads cannot exceed distinct-skill or aggregate character budgets',async()=>{
 const session=createSkillSession();const ids=['copywriting','ads','cro','social','seo-audit','analytics','ad-creative'];
 const results=await Promise.allSettled(ids.map(id=>readSkill({id},session)));assert.ok(results.some(result=>result.status==='rejected'));assert.ok(session.selected.size<=SKILL_POLICY.maxDistinctSkills);assert.ok(session.chars<=SKILL_POLICY.maxRunChars);assert.ok(session.calls<=SKILL_POLICY.maxReadCalls);
 const bounded=createSkillSession();bounded.chars=SKILL_POLICY.maxRunChars-40;const result=await readSkill({id:'aira-pdf'},bounded);assert.ok(result.chars<=40);assert.ok(result.truncated);assert.ok(bounded.chars<=SKILL_POLICY.maxRunChars);
 const fresh=createSkillSession();assert.equal(fresh.chars,0);assert.equal(fresh.selected.size,0);
});
test('browser events contain progress metadata, never imported prose or source infrastructure',async()=>{
 const result=await readSkill({id:'copywriting'},createSkillSession());const publicResult=publicSkillResult('read_skill',result);assert.equal(publicResult.id,result.id);assert.equal('content' in publicResult,false);assert.equal('provenance' in publicResult,false);assert.equal('references' in publicResult,false);assert.equal(JSON.stringify(publicResult).includes('coreyhaines31'),false);assert.deepEqual(publicSkillResult('search_skills',searchSkills({query:'conversion'})),{status:'methods_found',total:searchSkills({query:'conversion'}).total});
});
test('document originals are readable and declare content-only execution capabilities',async()=>{
 for(const id of ['aira-docx','aira-pdf','aira-pptx','aira-xlsx']){const method=await readSkill({id},createSkillSession());assert.equal(method.capability,'document_content_only');assert.equal(method.provenance.origin,'Aïra');assert.equal(method.version,'1.0.0');assert.ok(method.references.includes('references/controles.md'));}
});
