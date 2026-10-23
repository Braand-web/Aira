import {z} from 'zod';

// Shared bounds for model tools, history hydration and the editable user draft.
export const BRIEF_LIMITS={questions:5,options:8,title:160,question:240,option:120,custom:1000,draft:12000,result:65536} as const;
const text=(limit:number)=>z.string().trim().min(1).max(limit);
const unique=(values:string[])=>new Set(values.map(value=>value.toLocaleLowerCase('fr'))).size===values.length;
export const briefQuestionSchema=z.object({
 id:z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/u).refine(id=>!['__proto__','constructor','prototype'].includes(id),'Identifiant réservé.'),
 q:text(BRIEF_LIMITS.question),type:z.enum(['radio','check']),
 options:z.array(text(BRIEF_LIMITS.option)).min(2).max(BRIEF_LIMITS.options).refine(unique,'Les choix doivent être distincts.'),
}).strict();
export const briefQuestionnaireSchema=z.object({
 title:text(BRIEF_LIMITS.title),
 questions:z.array(briefQuestionSchema).min(1).max(BRIEF_LIMITS.questions)
  .refine(questions=>new Set(questions.map(question=>question.id)).size===questions.length,'Les identifiants doivent être distincts.'),
}).strict();
const resultSchema=briefQuestionnaireSchema.extend({kind:z.literal('brief_questions')}).strict();
export type BriefQuestion=z.infer<typeof briefQuestionSchema>;
export type BriefQuestionnaire=z.infer<typeof briefQuestionnaireSchema>;
export type BriefAnswer={selected:string[];custom:string};
export type BriefAnswers=Record<string,BriefAnswer>;
export type BriefCard=BriefQuestionnaire&{id:string};
export type BriefHistoryMessage={role:string;content:unknown};
type BriefToolResult={type:'tool_result';tool_use_id:string;content:string;is_error?:true};
export type BriefToolBatch={selectedId:string;questionnaire:BriefQuestionnaire|null;results:BriefToolResult[]};

export function parseBriefResult(value:unknown):BriefQuestionnaire|null{
 const parsed=resultSchema.safeParse(value);
 if(!parsed.success)return null;
 const {title,questions}=parsed.data;
 return {title,questions};
}

function plain(value:string){return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu,'').trim();}
function bounded(value:string,limit:number){
 const clean=plain(value);if(clean.length<=limit)return clean;
 const end=clean.slice(0,limit-1),boundary=end.lastIndexOf(' ');
 return (boundary>limit/2?end.slice(0,boundary):end)+'…';
}

/** Text for an editable draft only: selecting an answer never grants permission. */
export function formatBriefAnswers(questionnaire:BriefQuestionnaire,answers:BriefAnswers):string{
 // A hydrated BriefCard is a structural subtype and also carries its tool id.
 const parsed=briefQuestionnaireSchema.safeParse(questionnaire&&{title:questionnaire.title,questions:questionnaire.questions});
 if(!parsed.success)return '';
 const sections=[`Précisions pour « ${plain(parsed.data.title)} » :`];
 for(const question of parsed.data.questions){
  const answer=Object.hasOwn(answers,question.id)?answers[question.id]:undefined;
  const selected=Array.isArray(answer?.selected)?question.options.filter(option=>answer.selected.includes(option)):[];
  const picked=question.type==='radio'?selected.slice(0,1):selected;
  const custom=typeof answer?.custom==='string'?bounded(answer.custom,BRIEF_LIMITS.custom):'';
  const values=[...picked.map(value=>`- ${plain(value)}`),...(custom?[`- Autre : ${custom}`]:[])];
  sections.push(`${plain(question.q)}\n${values.length?values.join('\n'):'- Non précisé'}`);
 }
 sections.push('Ces réponses précisent ma demande. Toute génération, publication ou dépense reste soumise à sa validation habituelle.');
 return bounded(sections.join('\n\n'),BRIEF_LIMITS.draft);
}

function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}

/** Resolve the whole batch before any tool executes, even when the ask is last. */
export function prepareBriefToolBatch(blocks:readonly unknown[]):BriefToolBatch|null{
 const calls=blocks.filter((block):block is Record<string,unknown>&{id:string;name:string}=>record(block)&&block.type==='tool_use'&&typeof block.id==='string'&&typeof block.name==='string');
 const selected=calls.find(call=>call.name==='ask_brief_questions');if(!selected)return null;
 const parsed=briefQuestionnaireSchema.safeParse(selected.input),questionnaire=parsed.success?parsed.data:null;
 return {selectedId:selected.id,questionnaire,results:calls.map(call=>call===selected
  ?questionnaire
   ?{type:'tool_result',tool_use_id:call.id,content:JSON.stringify({kind:'brief_questions',...questionnaire})}
   :{type:'tool_result',tool_use_id:call.id,content:'Carte de cadrage invalide. Fournissez un titre, 1 à 5 questions et 2 à 8 choix distincts par question dans les limites du schéma.',is_error:true}
  :{type:'tool_result',tool_use_id:call.id,content:'Appel suspendu : répondez d’abord aux questions de cadrage. Aucune action n’a été exécutée.',is_error:true})};
}

function contentBlocks(value:unknown):unknown[]|null{
 if(Array.isArray(value))return value;
 if(typeof value!=='string')return null;
 try{const parsed:unknown=JSON.parse(value);return Array.isArray(parsed)?parsed:null;}catch{return null;}
}

/** Hydrate only successful, paired tool results from server-scoped message history. */
export function briefCardsFromHistory(contents:BriefHistoryMessage[]):BriefCard[][]{
 const cards:BriefCard[][]=contents.map(()=>[]);
 let pending=new Map<string,{index:number;questionnaire:BriefQuestionnaire}>();
 for(const [index,message] of contents.entries()){
  if(!record(message)){pending.clear();continue;}
  const blocks=contentBlocks(message.content);
  if(!blocks){pending.clear();continue;}
  if(message.role==='assistant'){
   pending=new Map();const seen=new Set<string>(),duplicateIds=new Set<string>();
   for(const block of blocks){
    if(!record(block)||block.type!=='tool_use'||typeof block.id!=='string')continue;
    if(seen.has(block.id))duplicateIds.add(block.id);seen.add(block.id);
    if(block.name!=='ask_brief_questions')continue;
    const parsed=briefQuestionnaireSchema.safeParse(block.input);
    if(parsed.success)pending.set(block.id,{index,questionnaire:parsed.data});
   }
   for(const id of duplicateIds)pending.delete(id);
  }else if(message.role==='user'){
   for(const block of blocks){
    if(!record(block)||block.type!=='tool_result'||typeof block.tool_use_id!=='string')continue;
    const entry=pending.get(block.tool_use_id);pending.delete(block.tool_use_id);
    if(!entry||(block.is_error!==undefined&&block.is_error!==false)||typeof block.content!=='string'||block.content.length>BRIEF_LIMITS.result)continue;
    let result:unknown;try{result=JSON.parse(block.content);}catch{continue;}
    const questionnaire=parseBriefResult(result);
    if(!questionnaire||JSON.stringify(questionnaire)!==JSON.stringify(entry.questionnaire))continue;
    cards[entry.index].push({id:block.tool_use_id,...questionnaire});
   }
   pending.clear();
  }else pending.clear();
 }
 return cards;
}
