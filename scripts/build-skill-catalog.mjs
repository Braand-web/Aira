// Compile reviewed Markdown into lazy, server-only modules. No network or scripts.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstat,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const skills=path.join(project,'skills'),output=path.join(project,'lib','skills');
// Keep the pinned upstream snapshot untouched, but remove legacy product
// naming from the server-only content shipped to Braand users.
const legacyBrandTokens=new RegExp([['a','i','r','a'],['a','ï','r','a']].map(parts=>parts.join('')).join('|'),'giu');
const currentBrand=(value)=>value===value.toUpperCase()?'BRAAND':value[0]===value[0].toUpperCase()?'Braand':'braand';
// Do not compile locally edited prose under a pinned upstream attribution.
// These checks are offline and run only our source-verification code.
for(const script of ['import-marketing-skills.mjs','import-social-skills.mjs','import-design-skill.mjs']){
 execFileSync(process.execPath,[path.join(project,'scripts',script),'--verify'],{cwd:project,stdio:'pipe'});
}
const definitions=JSON.parse(await readFile(path.join(skills,'catalog.json'),'utf8'));
const marketingManifest=JSON.parse(await readFile(path.join(skills,'vendor','marketing','manifest.json'),'utf8'));
const socialManifest=JSON.parse(await readFile(path.join(skills,'vendor','social','manifest.json'),'utf8'));
const designManifest=JSON.parse(await readFile(path.join(skills,'vendor','anthropic','frontend-design','manifest.json'),'utf8'));
const userManifest=JSON.parse(await readFile(path.join(skills,'user','social-media-manager','manifest.json'),'utf8'));
const generated=new Map();const index=[];const ids=new Set();
for(const definition of definitions){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)||ids.has(definition.id))throw Error('Invalid or duplicate skill identifier');
 ids.add(definition.id);
 const directory=path.resolve(skills,definition.directory);
 if(!directory.startsWith(skills+path.sep))throw Error('Skill outside approved directory');
 for(let current=directory;current!==project;current=path.dirname(current)){
  if((await lstat(current)).isSymbolicLink())throw Error('Skill directory symlinks forbidden');
 }
 const original=definition.license==='Braand-original';
 const marketing=definition.directory.startsWith('vendor/marketing/');
 const social=definition.directory.startsWith('vendor/social/');
 const design=definition.directory==='vendor/anthropic/frontend-design';
 const user=definition.directory==='user/social-media-manager'&&definition.license==='User-provided';
 if(!original&&!marketing&&!social&&!design&&!user)throw Error('Unknown vendored skill source');
 if((marketing||social)&&definition.license!=='MIT'||design&&definition.license!=='Apache-2.0')throw Error('Skill license disagrees with pinned source');
 const manifest=marketing?marketingManifest:social?socialManifest:user?userManifest:designManifest;
 const sourcePrefix=marketing||social?path.relative(path.join(skills,'vendor',marketing?'marketing':'social'),directory).split(path.sep).join('/')+'/':'';
 const expectedFiles=original?null:new Map(manifest.files.map(file=>[file.path,file]));
 const entries={};
 async function collect(folder,inReferences=false){for(const item of await readdir(folder,{withFileTypes:true})){
  if(item.isSymbolicLink())throw Error('Skill symlinks forbidden');
  const full=path.join(folder,item.name);
  if(item.isDirectory()){if(inReferences||item.name==='references'||user&&item.name==='assets')await collect(full,true);continue;}
  if(!item.isFile()||!item.name.endsWith('.md')&&!(user&&item.name.endsWith('.json')))continue;
  const relative=path.relative(directory,full).split(path.sep).join('/');
  if(relative!=='SKILL.md'&&!relative.startsWith('references/')&&!(user&&relative.startsWith('assets/')))continue;
  const bytes=await readFile(full);
  if(bytes.length>64000)throw Error('Skill file exceeds reviewed size');
  if(expectedFiles){
   const expected=expectedFiles.get(sourcePrefix+relative);
   if(!expected||bytes.length!==expected.bytes||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)throw Error('Unreviewed vendored content: '+relative);
  }
  const content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(original&&content.includes('\r'))throw Error('Original skill must use stable LF line endings');
  entries[relative]=content.replace(legacyBrandTokens,currentBrand);
 }}
 await collect(directory);if(!entries['SKILL.md'])throw Error('Missing SKILL.md: '+definition.id);
 if(original&&(!definition.directory.startsWith('braand/')||path.basename(directory)!==definition.id||!entries['SKILL.md'].startsWith('---\nname: '+definition.id+'\n')))throw Error('Original skill directory and name must match');
 const ordered=Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a.localeCompare(b,'en')));
 const provenance=manifest.source??manifest;
 const source=original?{origin:'Braand',revision:'1.0.0'}:{origin:provenance.repository,revision:provenance.commit};
 const version=original?'1.0.0':source.revision.slice(0,12);
 const references=Object.keys(ordered).filter(file=>file!=='SKILL.md');
 const metadata={id:definition.id,title:definition.title,description:definition.description,category:definition.category,license:definition.license,capability:definition.capability,version,source,references,digest:createHash('sha256').update(JSON.stringify(ordered)).digest('hex')};
 generated.set(path.join(output,'content',definition.id+'.generated.mjs'),'// Generated by scripts/build-skill-catalog.mjs. Reviewed source only.\nconst content = '+JSON.stringify(ordered,null,2)+';\nexport default content;\n');
 index.push('  {...'+JSON.stringify(metadata)+', load: () => import("./content/'+definition.id+'.generated.mjs").then(module => module.default)}');
}
generated.set(path.join(output,'catalog.generated.mjs'),'// Generated by scripts/build-skill-catalog.mjs. Server only; no client imports.\nexport const SKILL_CATALOG = [\n'+index.join(',\n')+'\n];\n');
if(process.argv.includes('--check')){
 for(const [file,content]of generated)if(await readFile(file,'utf8')!==content)throw Error('Stale generated skill: '+path.relative(project,file));
 console.log('Reviewed skill catalog is current.');
}else{
 for(const [file,content]of generated){await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content);}
 console.log('Compiled '+index.length+' reviewed skills with lazy content.');
}
