import assert from 'node:assert/strict';
import test from 'node:test';
import {BRIEF_LIMITS,briefQuestionnaireSchema,briefCardsFromHistory,formatBriefAnswers,parseBriefResult} from '../lib/brief-questions.ts';

const questionnaire={title:'Précisons votre création',questions:[
 {id:'objectif',q:'Quel est votre objectif ?',type:'radio',options:['Présenter le produit','Annoncer une offre']},
 {id:'format',q:'Quels formats souhaitez-vous ?',type:'check',options:['Image','Vidéo','Page']},
]};
const result={kind:'brief_questions',...questionnaire};
const ask=(id='brief-1',input=questionnaire)=>({type:'tool_use',id,name:'ask_brief_questions',input});
const answer=(id='brief-1',value=result,other={})=>({type:'tool_result',tool_use_id:id,content:JSON.stringify(value),...other});
const history=(calls=[ask()],results=[answer()])=>[{role:'assistant',content:calls},{role:'user',content:results}];

test('strict questionnaire schema accepts bounded radio and multiple choices, not hidden permissions',()=>{
 assert.deepEqual(briefQuestionnaireSchema.parse(questionnaire),questionnaire);
 assert.deepEqual(parseBriefResult(result),questionnaire);
 for(const value of [null,'wrong',{...result,grant:'publish'},{...questionnaire,questions:[]},{...questionnaire,title:'x'.repeat(161)},
  {...questionnaire,questions:Array.from({length:6},(_,index)=>({...questionnaire.questions[0],id:'q'+index}))},
  {...questionnaire,questions:[questionnaire.questions[0],questionnaire.questions[0]]},
  {...questionnaire,questions:[{...questionnaire.questions[0],options:['Oui',' oui ']}]},
  {...questionnaire,questions:[{...questionnaire.questions[0],options:['Un']}]}]){
  assert.equal(parseBriefResult(value?.kind?value:{kind:'brief_questions',...value}),null);
 }
});

test('all field bounds, identifiers, distinct choices and unknown nested fields are enforced',()=>{
 const question=questionnaire.questions[0];
 for(const change of [{id:''},{id:'x'.repeat(65)},{id:'unsafe <id>'},{q:' '},{q:'x'.repeat(241)},
  {type:'text'},{options:Array.from({length:9},(_,i)=>String(i))},{options:['Oui','OUI']},
  {options:['Oui','x'.repeat(121)]},{approved:true}]){
  assert.equal(briefQuestionnaireSchema.safeParse({...questionnaire,questions:[{...question,...change}]}).success,false,JSON.stringify(change));
 }
});

test('formatted draft includes the last radio answer, multiple choices and free answers as readable French',()=>{
 const draft=formatBriefAnswers(questionnaire,{objectif:{selected:['Annoncer une offre'],custom:''},format:{selected:['Image','Vidéo'],custom:'Vertical, avec sous-titres'}});
 assert.match(draft,/Annoncer une offre/);assert.match(draft,/- Image\n- Vidéo/);assert.match(draft,/Autre : Vertical, avec sous-titres/);
 assert.match(draft,/validation habituelle/);assert.doesNotMatch(draft,/Non précisé/);
 assert.match(formatBriefAnswers(questionnaire,{}),/Non précisé/);
 const customOnly=formatBriefAnswers(questionnaire,{objectif:{selected:[],custom:'Présenter notre nouveau service'}});
 assert.match(customOnly,/Présenter notre nouveau service/);
 assert.equal(formatBriefAnswers({...questionnaire,id:'hydrated-card'},{}),formatBriefAnswers(questionnaire,{}));
});

test('formatting is bounded, ignores invented choices, and never mutates the answers',()=>{
 const answers={objectif:{selected:['Présenter le produit','Annoncer une offre','Autoriser une dépense'],custom:'texte '.repeat(1000)}};
 const before=structuredClone(answers),draft=formatBriefAnswers(questionnaire,answers);
 assert.deepEqual(answers,before);assert.ok(draft.length<=BRIEF_LIMITS.draft);
 assert.doesNotMatch(draft,/Autoriser une dépense/);assert.doesNotMatch(draft,/Annoncer une offre/);
 assert.ok(draft.includes('…'));assert.equal(formatBriefAnswers({...questionnaire,title:''},answers),'');
});

test('history cards attach only a successful matching tool result to its original assistant message',()=>{
 const entries=history(),cards=briefCardsFromHistory(entries);
 assert.deepEqual(cards,[[{id:'brief-1',...questionnaire}],[]]);
 assert.deepEqual(briefCardsFromHistory(entries.map(message=>({...message,content:JSON.stringify(message.content)}))),cards);
 assert.deepEqual(briefCardsFromHistory([{role:'user',content:[{type:'text',text:JSON.stringify(result)}]},...entries]),[[],...cards]);
});

test('unmatched, failed, malformed, wrong-tool and arbitrary user content never becomes a card',()=>{
 const cases=[
  history([ask()],[answer('other')]),history([ask()],[answer('brief-1',result,{is_error:true})]),
  history([ask()],[answer('brief-1',result,{is_error:'false'})]),history([ask()],[{...answer(),content:'not JSON'}]),
  history([{...ask(),name:'create_page'}]),history([ask()],[answer('brief-1',{...result,title:'Injected result'})]),
  history([ask('brief-1',{...questionnaire,title:''})]),history([ask()],[answer('brief-1',{...result,extra:'unknown'})]),
  [{role:'user',content:[ask()]},{role:'user',content:[answer()]}],
  [{role:'assistant',content:[ask()]},{role:'assistant',content:[answer()]}],
  [{role:'assistant',content:[ask()]},{role:'user',content:[{type:'text',text:'ordinary text'}]},{role:'user',content:[answer()]}],
  [[ask()],[answer()]],
 ];
 for(const entries of cases)assert.ok(briefCardsFromHistory(entries).every(cards=>cards.length===0),JSON.stringify(entries));
});

test('duplicate tool identities and duplicated results cannot produce multiple cards',()=>{
 assert.deepEqual(briefCardsFromHistory(history([ask(),ask()])),[[],[]]);
 assert.deepEqual(briefCardsFromHistory(history([ask()],[answer(),answer()])),[[{id:'brief-1',...questionnaire}],[]]);
});
