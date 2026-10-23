// Explicit, pinned import of the Apache 2.0 frontend guide. No upstream code runs.
import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const commit='dbd4588f9e1033efb41dad4bef2f7947c8993d44';
const repository='https://github.com/anthropics/skills';
const license='Apache-2.0';
const project=fileURLToPath(new URL('../',import.meta.url));
const root=path.join(project,'skills','vendor','anthropic','frontend-design');
const maxFileBytes=64000;
const pinnedFiles=[
 {path:'SKILL.md',bytes:9390,sha256:'d91970639e9f5c37682ac7ab60094d35f1c7c1f38d731bd56396563aee10c1d3'},
 {path:'LICENSE.txt',bytes:10174,sha256:'0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594'},
].map(file=>({...file,sourcePath:'skills/frontend-design/'+file.path,url:`https://raw.githubusercontent.com/anthropics/skills/${commit}/skills/frontend-design/${file.path}`}));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function assert(condition,message){if(!condition)throw Error(message);}
function exactKeys(value,keys){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}

// Validate against constants reviewed in source, not hashes or paths supplied by
// the manifest itself. Exported for catalog generation and negative tests.
export function validateDesignManifest(manifest){
 assert(exactKeys(manifest,['repository','commit','license','files']),'Design manifest fields mismatch');
 assert(manifest.repository===repository&&manifest.commit===commit&&manifest.license===license,'Design manifest provenance mismatch');
 assert(Array.isArray(manifest.files)&&manifest.files.length===pinnedFiles.length,'Design manifest must contain both reviewed files');
 const seen=new Set();
 for(const file of manifest.files){
  assert(exactKeys(file,['path','sourcePath','url','bytes','sha256']),'Design manifest file fields mismatch');
  const expected=pinnedFiles.find(item=>item.path===file.path);
  assert(expected&&!seen.has(file.path),'Unselected or duplicate design source path');
  seen.add(file.path);
  for(const key of ['path','sourcePath','url','bytes','sha256'])assert(file[key]===expected[key],'Design source provenance or integrity mismatch: '+file.path);
 }
 return manifest;
}

async function assertNoSymlinks(absolute){
 const relative=path.relative(project,absolute);
 assert(relative&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'Design source path escape');
 let current=project;
 for(const part of [undefined,...relative.split(path.sep)]){
  if(part!==undefined)current=path.join(current,part);
  let entry;try{entry=await lstat(current);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  assert(!entry.isSymbolicLink(),'Design source symlink or junction forbidden');
 }
}
async function assertKnownFiles(){
 await assertNoSymlinks(root);
 let entries;try{entries=await readdir(root,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
 const allowed=new Set(['manifest.json',...pinnedFiles.map(file=>file.path)]);
 for(const entry of entries)assert(entry.isFile()&&!entry.isSymbolicLink()&&allowed.has(entry.name),'Unexpected design source entry: '+entry.name);
}
function validateBytes(bytes,file){
 assert(bytes.length===file.bytes&&bytes.length<=maxFileBytes&&sha256(bytes)===file.sha256,'Design source integrity mismatch: '+file.path);
 new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(file.path==='LICENSE.txt')assert(bytes.toString('utf8').includes('Apache License'),'Expected Apache license missing');
}

export async function verifyDesignSnapshot(){
 await assertKnownFiles();
 const manifest=validateDesignManifest(JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8')));
 for(const file of pinnedFiles){const absolute=path.join(root,file.path);await assertNoSymlinks(absolute);validateBytes(await readFile(absolute),file);}
 return manifest;
}

async function download(file){
 const response=await fetch(file.url,{redirect:'error',signal:AbortSignal.timeout(30000)});
 assert(response.status===200&&response.url===file.url,'Design source HTTP response mismatch');
 assert(/^text\/plain\b/i.test(response.headers.get('content-type')||''),'Unexpected design source content type');
 const length=response.headers.get('content-length');
 if(length!==null)assert(/^\d+$/.test(length)&&Number(length)<=maxFileBytes,'Design source too large');
 assert(response.body,'Design source body missing');
 let lengthRead=0;const chunks=[];
 for await(const chunk of response.body){lengthRead+=chunk.byteLength;assert(lengthRead<=maxFileBytes,'Design source too large');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);validateBytes(bytes,file);return bytes;
}
async function importSnapshot(){
 await assertKnownFiles();
 const downloaded=[];
 for(const file of pinnedFiles)downloaded.push({file,bytes:await download(file)});
 // All sources, license bytes and hashes are verified before any local write.
 await mkdir(root,{recursive:true});await assertNoSymlinks(root);
 for(const {file,bytes} of downloaded){const absolute=path.join(root,file.path);await assertNoSymlinks(absolute);await writeFile(absolute,bytes);}
 const manifest={repository,commit,license,files:pinnedFiles.map(file=>({path:file.path,sourcePath:file.sourcePath,url:file.url,bytes:file.bytes,sha256:file.sha256}))};
 const manifestPath=path.join(root,'manifest.json');await assertNoSymlinks(manifestPath);
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');await verifyDesignSnapshot();
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);
 assert(args.length===1&&['--verify','--import'].includes(args[0]),'Use --import or --verify explicitly.');
 if(args[0]==='--verify'){await verifyDesignSnapshot();console.log('Pinned design guide verified.');}
 else{await importSnapshot();console.log('Pinned design guide imported without modification.');}
}
