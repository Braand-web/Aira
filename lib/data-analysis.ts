import {z} from 'zod';
import {authorize,config,db,getResource,createResource} from './server';
import {AppError,safeFilename} from './core.mjs';
import {parseTableCSV,tableData,analyzeTable,tableCSV} from './data-engine.mjs';
import {saveGeneratedFile} from './generated-files';
import type {BillingIdentity} from './billing';
import type {FileRecord} from './contracts';
const column=z.string().min(1).max(80),cell=z.union([z.string().max(1000),z.number().finite(),z.boolean(),z.null()]);
const dataset=z.object({format:z.enum(['inline','csv','json','analysis']),columns:z.array(column).max(40).optional(),rows:z.array(z.array(cell).max(40)).max(500).optional(),fileId:z.string().min(1).max(160).optional(),analysisId:z.string().min(1).max(160).optional(),version:z.number().int().positive().optional(),delimiter:z.enum([',',';','\t']).optional()}).strict().superRefine((v,c)=>{
 const invalid=v.format==='inline'?(!v.columns||!v.rows||v.fileId!==undefined||v.analysisId!==undefined||v.version!==undefined||v.delimiter!==undefined):v.format==='analysis'?(!v.analysisId||!v.version||v.fileId!==undefined||v.columns!==undefined||v.rows!==undefined||v.delimiter!==undefined):(!v.fileId||!v.version||v.analysisId!==undefined||v.columns!==undefined||v.rows!==undefined||v.format==='json'&&v.delimiter!==undefined);
 if(invalid)c.addIssue({code:z.ZodIssueCode.custom,message:'Choisissez des lignes explicites ou une source versionnée, sans mélanger les deux.'});
});
const aggregate=z.object({op:z.enum(['count','sum','mean','min','max']),column:column.optional(),as:column}).strict().superRefine((v,c)=>{if(v.op!=='count'&&!v.column)c.addIssue({code:z.ZodIssueCode.custom,message:'Colonne numérique requise.'});});
const step=z.discriminatedUnion('op',[
 z.object({op:z.literal('select'),columns:z.array(column).min(1).max(40)}).strict(),
 z.object({op:z.literal('filter'),column,operator:z.enum(['eq','ne','lt','lte','gt','gte','contains','empty','not_empty']),value:cell.optional()}).strict(),
 z.object({op:z.literal('group'),by:z.array(column).max(3),aggregates:z.array(aggregate).min(1).max(8)}).strict(),
 z.object({op:z.literal('sort'),column,type:z.enum(['text','number']),direction:z.enum(['asc','desc'])}).strict(),
 z.object({op:z.literal('limit'),count:z.number().int().min(0).max(500)}).strict()
]);
const schema=z.object({title:z.string().trim().min(1).max(160),dataset,numberFormat:z.enum(['dot','comma']).default('dot'),steps:z.array(step).max(8)}).strict().superRefine((v,c)=>{if(v.steps.some(s=>s.op==='filter'&&!['empty','not_empty'].includes(s.operator)&&s.value===undefined))c.addIssue({code:z.ZodIssueCode.custom,message:'Valeur de filtre requise.'});});
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer)),n=>n.toString(16).padStart(2,'0')).join('');
function boundedRows(rows:(string|number|boolean|null)[][],offset:number,limit:number,maxChars:number){
 const selected:typeof rows=[];let chars=0;
 for(const row of rows.slice(offset,offset+limit)){const size=JSON.stringify(row).length;if(chars+size>maxChars)break;selected.push(row);chars+=size;}
 return selected;
}
export async function analyzeData(who:BillingIdentity,raw:unknown){
 await authorize(who.tenant,who.user.userId,'write');const p=schema.parse(raw),bucket=config().BUCKET;
 if(!bucket)throw new AppError('Stockage des fichiers indisponible.',503);
 let table:ReturnType<typeof tableData>,source:Record<string,unknown>={kind:'inline'},inputHash:string;
 try{
  if(p.dataset.format==='inline'){
   table=tableData({columns:p.dataset.columns,rows:p.dataset.rows});inputHash=await hash(new TextEncoder().encode(JSON.stringify(table)));source={kind:'inline',input:table};
  }else if(p.dataset.format==='analysis'){
   const previous=await getResource(who.tenant,p.dataset.analysisId!);
   if(previous.kind!=='deliverable'||previous.data.format!=='data-analysis'||previous.status==='deleted'||previous.version!==p.dataset.version)throw new AppError('Analyse source indisponible ou périmée.',409,'analysis_source_invalid');
   const saved=z.object({columns:z.array(column),rows:z.array(z.array(cell)),numberFormat:z.enum(['dot','comma'])}).parse(previous.data.analysis);
   if(saved.numberFormat!==p.numberFormat)throw new AppError('Conservez le format décimal de l’analyse source.',400,'analysis_number_format_changed');
   table=tableData(saved);inputHash=await hash(new TextEncoder().encode(JSON.stringify(table)));source={kind:'analysis',id:previous.id,version:previous.version,sha256:inputHash};
  }else{
   const resource=await getResource(who.tenant,p.dataset.fileId!),file=await db().prepare("SELECT * FROM files WHERE id=? AND workspace_id=? AND status='ready'").bind(resource.id,who.tenant).first<FileRecord>();
   if(resource.kind!=='file'||resource.status==='deleted'||resource.version!==p.dataset.version||!file?.storage_key||file.size_bytes>131072||!file.sha256||!['text/plain','text/csv','application/json'].includes(file.detected_mime))throw new AppError('Fichier source indisponible, périmé ou non pris en charge (128 Kio maximum).',409,'analysis_source_invalid');
   const object=await bucket.get(file.storage_key);if(!object||object.size>131072)throw new AppError('Fichier source indisponible.',409,'analysis_source_invalid');
   const bytes=new Uint8Array(await object.arrayBuffer());inputHash=await hash(bytes);if(bytes.length!==file.size_bytes||inputHash!==file.sha256)throw new AppError('Le fichier ne correspond plus à son empreinte.',409,'analysis_source_changed');
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   table=p.dataset.format==='csv'?parseTableCSV(text,p.dataset.delimiter||','):tableData(JSON.parse(text));
   source={kind:'owned_file',id:resource.id,version:resource.version,sha256:inputHash,format:p.dataset.format};
  }
 }catch(error){if(error instanceof AppError)throw error;throw new AppError(error instanceof Error?error.message:'Données invalides.',422,'analysis_input_invalid');}
 let result:ReturnType<typeof analyzeTable>;try{result=analyzeTable(table,p.steps,p.numberFormat);}catch(error){throw new AppError(error instanceof Error?error.message:'Analyse invalide.',422,'analysis_plan_invalid');}
 const outputHash=await hash(new TextEncoder().encode(JSON.stringify({columns:result.columns,rows:result.rows})));
 const summary=`${result.inputRows} ligne(s) traitée(s), ${result.outputRows} ligne(s) en sortie. Calcul déterministe, sans code libre ni appel fournisseur.`;
 const content=summary+'\n\nColonnes : '+result.columns.join(', ')+'.\n\n'+result.notes.join('\n')+'\n\nLe CSV contient le résultat complet. Les cellules vides restent distinctes de zéro. Les sommes utilisent une arithmétique décimale à six positions ; les moyennes sont arrondies à six décimales. Aucun système externe n’a été modifié.';
 const resource=await createResource(who.tenant,'deliverable',p.title,{title:p.title,summary,content,category:'analysis',sources:[],format:'data-analysis',executionConfirmed:true,analysis:{schema:1,source,inputHash,outputHash,numberFormat:p.numberFormat,steps:p.steps,columns:result.columns,rows:result.rows,notes:result.notes,inputRows:result.inputRows,outputRows:result.outputRows}},'draft');
 const file=await saveGeneratedFile(who,{source:resource,name:safeFilename(p.title)+'.csv',mime:'text/plain',format:'csv',bytes:new TextEncoder().encode(tableCSV(result))});
 const preview=boundedRows(result.rows,0,8,6000);
 return {...resource,data:{title:p.title,summary,content,category:'analysis',sources:[],format:'data-analysis',executionConfirmed:true},file,inputHash,outputHash,inputRows:result.inputRows,outputRows:result.outputRows,columns:result.columns,preview,previewTruncated:preview.length<result.rows.length,notes:result.notes,execution:'computed',externalChanges:false};
}
export async function getAnalysisResult(who:BillingIdentity,raw:unknown){
 await authorize(who.tenant,who.user.userId,'read');
 const p=z.object({id:z.string().min(1).max(160),version:z.number().int().positive().optional(),offset:z.number().int().min(0).max(500).default(0),limit:z.number().int().min(1).max(50).default(20),columns:z.array(column).min(1).max(40).optional()}).strict().parse(raw),resource=await getResource(who.tenant,p.id);
 if(resource.kind!=='deliverable'||resource.data.format!=='data-analysis'||resource.status==='deleted')throw new AppError('Analyse introuvable.',404);
 if(p.version!==undefined&&resource.version!==p.version)throw new AppError('La version de l’analyse a changé.',409,'stale_version');
 const data=z.object({columns:z.array(column),rows:z.array(z.array(cell)),numberFormat:z.enum(['dot','comma']),inputHash:z.string(),outputHash:z.string(),notes:z.array(z.string())}).parse(resource.data.analysis),table=tableData(data);
 if(p.offset>table.rows.length)throw new AppError('Position de lecture invalide.',400);
 const chosen=p.columns?analyzeTable(table,[{op:'select',columns:p.columns}],data.numberFormat):table;
 const rows=boundedRows(chosen.rows,p.offset,p.limit,12000);if(!rows.length&&p.offset<table.rows.length)throw new AppError('Cette ligne dépasse le budget de lecture. Sélectionnez moins de colonnes ou traitez le résultat complet avec analyze_data.',413,'analysis_read_limit');
 const end=p.offset+rows.length;
 return {id:resource.id,version:resource.version,columns:chosen.columns,rows,offset:p.offset,nextOffset:end<table.rows.length?end:null,totalRows:table.rows.length,truncated:p.offset>0||end<table.rows.length||Boolean(p.columns),numberFormat:data.numberFormat,inputHash:data.inputHash,outputHash:data.outputHash,notes:data.notes};
}
