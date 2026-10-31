import {documentZip} from './document-export.mjs';
const encoder=new TextEncoder();
export const SOURCE_LIMITS=Object.freeze({files:32,bytes:131072,fileChars:40000});
export function sourcePath(value){
 if(typeof value!=='string'||!value||value.length>120||value!==value.normalize('NFKC')||/[<>:"\\|?*\u0000-\u001f]/u.test(value)||value.startsWith('/'))throw new TypeError('Chemin source invalide.');
 const parts=value.split('/');
 if(parts.some(part=>!part||part==='.'||part==='..'||part.length>64||/[. ]$/.test(part)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)||['.git','node_modules','.venv','.npmrc','.pypirc','id_rsa','id_ed25519'].includes(part.toLowerCase())||/^\.env(?:\.|$)/i.test(part)&&part!=='.env.example')||value.toLowerCase()==='braand.project.json')throw new TypeError('Chemin source réservé ou non autorisé.');
 return value;
}
export function sourceFiles(files){
 if(!Array.isArray(files)||files.length<1||files.length>SOURCE_LIMITS.files)throw new RangeError('Un projet contient de 1 à 32 fichiers.');
 const paths=new Set();let total=0;
 const result=files.map(file=>{const path=sourcePath(file.path);if(paths.has(path.toLowerCase()))throw new TypeError('Chemins sources ambigus ou dupliqués.');paths.add(path.toLowerCase());
  if(typeof file.content!=='string'||file.content.length>SOURCE_LIMITS.fileChars||file.content.includes('\0')||new TextDecoder().decode(encoder.encode(file.content))!==file.content)throw new TypeError('Contenu source textuel invalide.');
  total+=encoder.encode(file.content).length;return {path,content:file.content};
 });
 if(total>SOURCE_LIMITS.bytes)throw new RangeError('Les sources dépassent 128 Kio.');
 for(const value of paths)if([...paths].some(other=>other!==value&&other.startsWith(value+'/')))throw new TypeError('Un fichier ne peut pas aussi être un dossier.');
 return result.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
export async function sourceArchive(raw,revision){
 const files=sourceFiles(raw),manifest=await Promise.all(files.map(async file=>{const bytes=encoder.encode(file.content),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');return {path:file.path,bytes:bytes.length,sha256:hash};}));
 const metadata={schema:'braand-source-project-v1',revision,files:manifest,execution:'not_executed',tests:'not_run',deployment:'not_deployed'};
 return {bytes:documentZip(Object.fromEntries([...files.map(file=>[file.path,file.content]),['braand.project.json',JSON.stringify(metadata,null,2)]])),manifest,sourceBytes:manifest.reduce((n,file)=>n+file.bytes,0)};
}
