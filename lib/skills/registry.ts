import {z} from 'zod';
import {AppError} from '../core.mjs';
import {SKILL_CATALOG} from './catalog.generated.mjs';
import {SKILL_POLICY,SKILL_METHOD_RULES} from './policy.mjs';

type SkillEntry={id:string;title:string;description:string;category:string;license:string;capability:string;version:string;source:{origin:string;revision:string};references:string[];digest:string;load:()=>Promise<Record<string,string>>};
export type SkillSession={calls:number;chars:number;selected:Set<string>};
export const createSkillSession=():SkillSession=>({calls:0,chars:0,selected:new Set()});
const catalog=SKILL_CATALOG as SkillEntry[];
export const skillToolNames=new Set(['search_skills','read_skill']);
const metadata=(entry:SkillEntry)=>({id:entry.id,title:entry.title,description:entry.description,category:entry.category,version:entry.version,capability:entry.capability});
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
export function skillDiscoveryContext(){return SKILL_METHOD_RULES+'\nCatalogue des méthodes disponibles (la description sert à choisir ; lis read_skill avant application) :\n'+catalog.map(entry=>entry.id+' : '+entry.description).join('\n');}
export function searchSkills(input:unknown){
 const {query='',category}=z.object({query:z.string().max(SKILL_POLICY.maxQueryChars).optional(),category:z.enum(['marketing','creative','documents']).optional()}).strict().parse(input);
 const terms=normalize(query).split(/\s+/).filter(Boolean);
 const candidates=catalog.filter(entry=>!category||entry.category===category).map(entry=>({entry,score:terms.reduce((score,term)=>score+(normalize(entry.id+' '+entry.title+' '+entry.description).includes(term)?1:0),0)}));
 const matching=terms.length?candidates.filter(item=>item.score>0):candidates;
 matching.sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id,'en'));
 return {skills:matching.slice(0,SKILL_POLICY.maxSearchResults).map(item=>metadata(item.entry)),total:matching.length,truncated:matching.length>SKILL_POLICY.maxSearchResults,source:'reviewed_catalog'};
}
function endAtBoundary(text:string,start:number,limit:number){
 let end=Math.min(text.length,start+limit);if(end===text.length)return end;
 if(end>start&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;
 const part=text.slice(start,end),line=part.lastIndexOf('\n'),word=part.lastIndexOf(' ');
 const boundary=line>part.length/2?line+1:word>part.length/2?word+1:part.length;
 return start+boundary;
}
export async function readSkill(input:unknown,session:SkillSession){
 const {id,reference='SKILL.md',offset=0}=z.object({id:z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),reference:z.string().max(180).optional(),offset:z.number().int().nonnegative().optional()}).strict().parse(input);
 const entry=catalog.find(item=>item.id===id);
 if(!entry||!['SKILL.md',...entry.references].includes(reference))throw new AppError('Compétence ou référence indisponible.',404,'skill_not_found');
 if(reference!=='SKILL.md'&&!session.selected.has(id))throw new AppError('Consulte d’abord le fichier SKILL.md de cette compétence.',409,'skill_entry_required');
 const files=await entry.load(),content=files[reference];
 if(typeof content!=='string'||offset>content.length||offset>0&&/[\uDC00-\uDFFF]/.test(content[offset]))throw new AppError('Position de lecture de compétence invalide.',400,'skill_offset_invalid');
 // Charge only after loading, with no await between checking and accounting:
 // concurrent reads share the same request budget without oversubscription.
 if(session.calls>=SKILL_POLICY.maxReadCalls||session.chars>=SKILL_POLICY.maxRunChars||!session.selected.has(id)&&session.selected.size>=SKILL_POLICY.maxDistinctSkills)throw new AppError('Le budget de lecture des compétences est atteint. Termine avec les méthodes déjà consultées ou précise la demande suivante.',409,'skill_context_limit');
 const end=endAtBoundary(content,offset,Math.min(SKILL_POLICY.maxReadChars,SKILL_POLICY.maxRunChars-session.chars));
 const excerpt=content.slice(offset,end);session.calls++;session.chars+=excerpt.length;session.selected.add(id);
 return {...metadata(entry),reference,offset,nextOffset:end<content.length?end:null,totalChars:content.length,chars:excerpt.length,truncated:end<content.length||offset>0,content:excerpt,references:entry.references,provenance:{...entry.source,license:entry.license,digest:entry.digest},budget:{remainingChars:SKILL_POLICY.maxRunChars-session.chars,remainingReads:SKILL_POLICY.maxReadCalls-session.calls}};
}
export function publicSkillResult(name:string,result:unknown){
 const value=result&&typeof result==='object'?result as Record<string,unknown>:{};
 if(name==='read_skill')return {id:value.id,title:value.title,version:value.version,reference:value.reference,chars:value.chars,truncated:value.truncated,status:'method_loaded'};
 if(name==='search_skills')return {status:'methods_found',total:value.total};
 return result;
}
