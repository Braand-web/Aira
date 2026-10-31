import {AppError} from '../core.mjs';

export const PACK_PREFIX='skills/packs/v1/';
export const MAX_PACK_ASSET_BYTES=8*1024*1024;

export function packFile(files,reference){
 const file=Object.hasOwn(files,reference)?files[reference]:undefined;
 if(!file||!/^([a-f0-9]{64})$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>MAX_PACK_ASSET_BYTES)throw new AppError('Ressource de compétence introuvable.',404,'skill_not_found');
 return file;
}
export async function packedAsset(files,reference,storage){
 const file=packFile(files,reference);
 if(!storage)throw new AppError('Stockage des compétences indisponible.',503,'skill_storage_unavailable');
 const object=await storage.get(PACK_PREFIX+file.sha256);
 if(!object||object.size!==file.bytes)throw new AppError('Ressource de compétence indisponible.',503,'skill_content_unavailable');
 const bytes=await object.arrayBuffer();
 if(bytes.byteLength!==file.bytes)throw new AppError('Ressource de compétence incomplète.',503,'skill_content_invalid');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
 if(hash!==file.sha256)throw new AppError('Intégrité de la compétence non vérifiée.',503,'skill_content_invalid');
 return {file,bytes};
}
export async function loadPackedReference(id,files,reference='SKILL.md',storage){
 const file=packFile(files,reference);
 if(!file.text)return {[reference]:'Ressource binaire conservée : '+reference+' ('+file.bytes+' octets). Téléchargement privé : /api/skills/'+encodeURIComponent(id)+'/asset?reference='+encodeURIComponent(reference)+'. Ce lien permet de récupérer la ressource ; il ne signifie pas qu’elle a été ouverte, vérifiée ou exécutée.'};
 const {bytes}=await packedAsset(files,reference,storage);
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new AppError('Texte de compétence invalide.',503,'skill_content_invalid');}
 return {[reference]:text};
}
