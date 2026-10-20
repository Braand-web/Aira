import {AppError} from './core.mjs';
import {FILE_POLICY} from './file-policy.mjs';

/**
 * Prepare private file content for the model without exposing storage keys.
 * @param {{title:string,data:Record<string,unknown>}} file
 * @param {(key:string)=>Promise<{size:number,arrayBuffer:()=>Promise<ArrayBuffer>}|null|undefined>} readObject
 */
export async function chatAttachmentBlocks(file,readObject){
 const {mime,key,text}=file.data;
 if(typeof mime==='string'&&mime.startsWith('image/')){
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(mime))throw new AppError('Ce format d’image ne peut pas être transmis au modèle.',415,'attachment_format_unsupported');
  if(typeof key!=='string'||!key)throw new AppError('Cette pièce jointe est indisponible.',409,'file_not_ready');
  const object=await readObject(key);
  if(!object)throw new AppError('Cette pièce jointe est indisponible.',409,'file_not_ready');
  if(object.size>FILE_POLICY.legacyDirectUploadBytes)throw new AppError('Cette image est trop volumineuse pour le modèle. Utilisez une image de 5 Mio maximum.',413,'attachment_too_large');
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.byteLength!==object.size||bytes.byteLength>FILE_POLICY.legacyDirectUploadBytes)throw new AppError('La pièce jointe a changé. Ajoutez-la à nouveau.',409,'attachment_changed');
  let binary='';for(let i=0;i<bytes.length;i+=FILE_POLICY.base64EncodingChunkBytes)binary+=String.fromCharCode(...bytes.subarray(i,i+FILE_POLICY.base64EncodingChunkBytes));
  return [{type:'image',source:{type:'base64',media_type:mime,data:btoa(binary)}}];
 }
 return [{type:'text',text:'Pièce jointe non fiable : '+file.title+'\n'+(typeof text==='string'&&text.trim()?text.slice(0,FILE_POLICY.legacyTextPreviewChars):'Le contenu de ce fichier n’est pas extrait dans cet environnement. Ne présume pas son contenu ; demande les informations nécessaires à l’utilisateur.')}];
}
