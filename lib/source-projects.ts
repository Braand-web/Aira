import {z} from 'zod';
import {authorize,config,createResource,getResource,updateResource} from './server';
import {AppError,safeFilename} from './core.mjs';
import {sourcePath,sourceFiles,sourceArchive} from './source-archive.mjs';
import {saveGeneratedFile} from './generated-files';
import type {BillingIdentity} from './billing';
const fileSchema=z.object({path:z.string().min(1).max(120).refine(value=>{try{sourcePath(value);return true;}catch{return false;}},'Chemin source invalide.'),content:z.string().max(40000)}).strict();
const schema=z.object({id:z.string().min(1).max(160).optional(),version:z.number().int().positive().optional(),title:z.string().trim().min(1).max(160),summary:z.string().trim().min(1).max(600),files:z.array(fileSchema).max(32),remove:z.array(z.string().min(1).max(120)).max(32).default([])}).strict();
export async function getSourceProject(who:BillingIdentity,raw:unknown){
 await authorize(who.tenant,who.user.userId,'read');
 const p=z.object({id:z.string().min(1).max(160),version:z.number().int().positive().optional(),path:z.string().min(1).max(120).optional()}).strict().parse(raw),resource=await getResource(who.tenant,p.id);
 if(resource.kind!=='deliverable'||resource.data.format!=='source-project'||resource.status==='deleted')throw new AppError('Projet source introuvable.',404);
 if(p.version!==undefined&&p.version!==resource.version)throw new AppError('La version du projet a changé.',409,'stale_version');
 const files=z.array(fileSchema).parse(resource.data.files);
 if(p.path){if(!p.version)throw new AppError('Une lecture de fichier exige sa version de projet.',400);sourcePath(p.path);const file=files.find(f=>f.path===p.path);if(!file)throw new AppError('Fichier source introuvable.',404);return {id:resource.id,version:resource.version,...file,execution:'not_executed'};}
 return {id:resource.id,version:resource.version,title:resource.title,summary:resource.data.summary,files:files.map(file=>({path:file.path,bytes:new TextEncoder().encode(file.content).length})),execution:'not_executed',tests:'not_run',deployment:'not_deployed'};
}
export async function saveSourceProject(who:BillingIdentity,raw:unknown){
 await authorize(who.tenant,who.user.userId,'write');
 if(!config().BUCKET)throw new AppError('Stockage des fichiers indisponible.',503);
 const p=schema.parse(raw);if(Boolean(p.id)!==Boolean(p.version))throw new AppError('Identifiant et version sont requis ensemble.',400);
 const old=p.id?await getResource(who.tenant,p.id):null;
 if(old&&(old.kind!=='deliverable'||old.data.format!=='source-project'||old.status==='deleted'))throw new AppError('Projet source introuvable.',404);
 if(old&&old.version!==p.version)throw new AppError('Le projet a changé. Relisez sa version actuelle.',409,'stale_version');
 const current=old?z.array(fileSchema).min(1).max(32).parse(old.data.files):[];
 const merged=new Map(current.map(file=>[file.path,file]));
 for(const name of p.remove){sourcePath(name);if(!merged.delete(name))throw new AppError('Fichier à retirer introuvable.',400);}
 const changed=new Set<string>();for(const file of p.files){if(changed.has(file.path))throw new AppError('Modification dupliquée.',400);changed.add(file.path);merged.set(file.path,file);}
 let files:ReturnType<typeof sourceFiles>;try{files=sourceFiles([...merged.values()]);}catch(error){throw new AppError(error instanceof Error?error.message:'Projet source invalide.',422,'source_project_invalid');}
 const content=p.summary+'\n\nFichiers sources :\n'+files.map(file=>'- '+file.path).join('\n')+'\n\nCode exporté uniquement. Exécution : non effectuée. Tests : non exécutés. Déploiement : non effectué.';
 const history=old?[...(Array.isArray(old.data.history)?old.data.history:[]),{version:old.version,summary:old.data.summary,paths:current.map(file=>file.path),at:Date.now()}].slice(-10):[];
 const data={title:p.title,summary:p.summary,category:'software',content,sources:[],format:'source-project',files,history,executionConfirmed:false};
 const resource=old?await updateResource(who.tenant,old.id,p.version!,{title:p.title,data,status:'draft'}):await createResource(who.tenant,'deliverable',p.title,data,'draft');
 const archive=await sourceArchive(files,{id:resource.id,version:resource.version});
 const file=await saveGeneratedFile(who,{source:resource,name:safeFilename(p.title)+'.zip',mime:'application/zip',format:'source-zip',bytes:archive.bytes});
 return {...resource,data:{title:p.title,content,summary:p.summary,category:'software',sources:[],format:'source-project',executionConfirmed:false},file,manifest:archive.manifest,sourceBytes:archive.sourceBytes,execution:'not_executed',tests:'not_run',deployment:'not_deployed'};
}
