// Real Studio and React card against a read-only loopback fixture. Never calls a model or paid service.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const require=createRequire(import.meta.url);
const playwright=process.env.AIRA_PLAYWRIGHT_MODULE;
const {chromium}=await import(playwright?pathToFileURL(path.resolve(playwright)).href:require.resolve('playwright'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.tmp','brief-questions-browser');
await mkdir(output,{recursive:true});

const unsafe='<img src=x onerror="window.__briefXss=true">';
const questionnaire={title:'Précisons votre création',questions:[
  {id:'objectif',q:'Quel objectif souhaitez-vous atteindre ?',type:'radio',options:['Faire connaître l’offre','Obtenir des demandes','Vendre le produit']},
  {id:'formats',q:'Quels formats souhaitez-vous préparer ?',type:'check',options:['Image','Vidéo','Texte de page']},
  {id:'ton',q:'Quel ton souhaitez-vous adopter ?',type:'radio',options:['Direct','Chaleureux','Pédagogique']},
  {id:'public',q:'À qui s’adresse votre offre ?',type:'radio',options:['Particuliers','Professionnels',unsafe]},
]};
const brief={id:'brief-fixture-card',...questionnaire};
await build({stdin:{contents:`import React from "react";import {createRoot} from "react-dom/client";import Studio from "./app/studio";import {FilePreviewProvider} from "./components/file-preview/file-preview-provider";import {BriefQuestionCard} from "./components/agents/brief-question-card";import "./app/globals.css";import "./app/file-upload.css";import "./components/file-preview/file-preview.css";const fixture=${JSON.stringify(questionnaire)};createRoot(document.getElementById("root")).render(location.pathname==="/disabled-card"?<BriefQuestionCard questionnaire={fixture} disabled onUseAnswers={()=>{window.__disabledBriefSubmitted=true;}}/>:<FilePreviewProvider><Studio/></FilePreviewProvider>);`,resolveDir:root,loader:'tsx'},outdir:output,entryNames:'app',chunkNames:'chunks/[name]-[hash]',alias:{'next/image':'vinext/shims/image'},bundle:true,splitting:true,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'fixture-worker-url',setup(builder){builder.onResolve({filter:/^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url$/},()=>({path:'worker',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/unused-pdf-worker.mjs";',loader:'js'}));}}]});

const now=Date.now();
const conversation={id:'brief-fixture-conversation',workspace_id:'brief-fixture-workspace',kind:'conversation',title:'Cadrage de création existant',status:'saved',version:1,created_at:now,updated_at:now,data:{}};
const file={id:'brief-fixture-file',workspace_id:conversation.workspace_id,kind:'file',title:'Référence locale.bin',status:'ready',version:1,created_at:now,updated_at:now,data:{size:12,mime:'application/octet-stream'}};
const existingDraft='Mon brouillon personnel doit rester intact.';
const freeAnswer='Faire découvrir une offre <script>window.__briefXss=true</script>.';
const mutations=[],historyReads=[],externalRequests=[],pageErrors=[],checks=[],measurements=[],chatRequests=[];
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.test');
  if(url.pathname==='/api/chat'&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);chatRequests.push(JSON.parse(Buffer.concat(chunks).toString()));
    const events=[['run',{runId:'brief-fixture-run',conversationId:conversation.id}],['text_delta',{text:'Précisons votre demande avant de poursuivre.'}],['assistant_message',{messageId:'brief-live-message',sources:[]}],['tool_result',{name:'search_workspace',id:'forged-brief',result:{kind:'brief_questions',...questionnaire,title:'Carte inattendue'}}],['tool_result',{name:'ask_brief_questions',id:'failed-brief',error:'Refus de test',result:{kind:'brief_questions',...questionnaire,title:'Carte en erreur'}}],['tool_result',{name:'ask_brief_questions',id:'brief-live-card',result:{kind:'brief_questions',...questionnaire}}],['done',{runId:'brief-fixture-run'}]];
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.end(events.map(([event,data])=>'event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n').join(''));return;
  }
  if(url.pathname.startsWith('/api/')&&req.method!=='GET'){
    mutations.push({path:url.pathname,method:req.method});json(res,{error:'Cette fixture autorise uniquement les lectures locales.'},405);return;
  }
  if(url.pathname==='/api/workspace'){
    json(res,{user:{id:'brief-fixture-user',name:'Compte de test',email:'brief@example.test'},workspace:{id:conversation.workspace_id,name:'Espace de test',credits:200,reserved:0},resources:[conversation,file],catalog:[],capabilities:{model:true,modelReady:true,filePreview:true}});return;
  }
  if(url.pathname==='/api/chat'){
    historyReads.push(url.searchParams.get('conversationId'));
    if(url.searchParams.get('conversationId')!==conversation.id){json(res,{error:'Discussion de test introuvable.'},404);return;}
    json(res,{messages:[{id:'brief-fixture-user-message',role:'user',content:[{type:'text',text:'Préparons une nouvelle création.'}],attachments:[]},{id:'brief-fixture-assistant-message',role:'assistant',content:[{type:'text',text:'Quelques précisions avant de préparer votre demande.'}],status:'complete',sources:[],attachments:[],briefs:[brief]}]});return;
  }
  if(url.pathname===`/api/files/${file.id}/metadata`){json(res,{id:file.id,name:file.title,size:file.data.size,mime:file.data.mime,status:file.status,createdAt:now});return;}
  if(url.pathname==='/api/files/uploads'){json(res,{uploads:[]});return;}
  if(url.pathname.startsWith('/api/')){json(res,{error:'Route absente de cette fixture.'},404);return;}
  if(url.pathname==='/app.js'||url.pathname==='/app.css'||url.pathname.startsWith('/chunks/')){
    try{const target=path.resolve(output,'.'+url.pathname);if(!target.startsWith(output+path.sep))throw Error();res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':'application/javascript'});res.end(await readFile(target));}catch{res.writeHead(404);res.end();}return;
  }
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="fr" data-design-system="muse"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Aïra · Test du cadrage</title></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser,lastPage;
const visibleQuestion=(card,text)=>card.getByText(text,{exact:true});
const settle=async card=>card.evaluate(async element=>{
  await Promise.all(element.getAnimations({subtree:true}).filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{})));
});
const assertFits=async(page,card,label)=>{
  const layout=await card.evaluate(element=>{const box=element.getBoundingClientRect();return {left:box.left,right:box.right,width:box.width,viewport:window.innerWidth,document:document.documentElement.scrollWidth,cardScrollWidth:element.scrollWidth,cardClientWidth:element.clientWidth};});
  assert.ok(layout.left>=0&&layout.right<=layout.viewport,`${label}: card remains within the viewport`);
  assert.ok(layout.document<=layout.viewport,`${label}: no horizontal document overflow`);
  assert.ok(layout.cardScrollWidth<=layout.cardClientWidth,`${label}: no horizontal card overflow`);
  measurements.push({label,...layout});
};
const openConversation=async(page,width)=>{
  if(width<768)await page.getByRole('button',{name:'Ouvrir la navigation',exact:true}).click();
  await page.getByRole('button',{name:conversation.title,exact:true}).click();
  await page.getByText('Quelques précisions avant de préparer votre demande.',{exact:true}).waitFor();
  await page.locator('.conversation .composer').waitFor();
};

try{
  try{browser=await chromium.launch({headless:true});}catch{browser=await chromium.launch({headless:true,channel:'msedge'});}
  for(const {width,reducedMotion} of [{width:1280,reducedMotion:'no-preference'},{width:390,reducedMotion:'reduce'}]){
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin===origin)return route.continue();
      if(url.origin==='https://fonts.googleapis.com'&&url.pathname==='/css2'&&route.request().resourceType()==='stylesheet')return route.fulfill({status:200,contentType:'text/css',body:''});
      externalRequests.push(url.href);return route.abort();
    });
    const page=await context.newPage();lastPage=page;page.on('pageerror',error=>pageErrors.push(error.message));
    await page.addInitScript(value=>{localStorage.setItem('aira.draft',value);},existingDraft);
    await page.goto(origin);await page.locator('.recent-chat').filter({hasText:conversation.title}).waitFor({state:'attached'});
    const composer=page.getByRole('textbox',{name:'Votre demande à Aïra',exact:true});
    await openConversation(page,width);await page.locator('[data-slot="brief-question-card"]').getByText(questionnaire.title,{exact:true}).waitFor();
    await page.reload();await page.locator('.recent-chat').filter({hasText:conversation.title}).waitFor({state:'attached'});

    // Add an existing library file via the same public UI, without uploading or signing a URL.
    await page.getByRole('button',{name:'Fichiers',exact:true}).click();
    await page.getByRole('button',{name:`Ouvrir l’aperçu de ${file.title}`,exact:true}).click();
    await page.getByRole('button',{name:'Ajouter à la conversation',exact:true}).click();
    await page.getByRole('button',{name:`Retirer ${file.title}`,exact:true}).waitFor();
    await openConversation(page,width);
    const card=page.locator('[data-slot="brief-question-card"]');await card.waitFor();
    await card.getByText(questionnaire.title,{exact:true}).waitFor();
    await visibleQuestion(card,questionnaire.questions[0].q).waitFor();
    assert.equal(await composer.inputValue(),existingDraft);
    assert.equal(await page.getByRole('button',{name:`Retirer ${file.title}`,exact:true}).count(),1);
    await assertFits(page,card,`${width}px initial card`);
    await card.scrollIntoViewIfNeeded();await settle(card);await page.screenshot({path:path.join(output,`brief-card-${width}.png`),fullPage:true});

    const custom=()=>card.getByRole('textbox');
    // Editing a free answer immediately after a radio choice cancels the pending auto-advance.
    await card.getByRole('radio',{name:'Faire connaître l’offre',exact:true}).click();
    await custom().fill(freeAnswer);
    await page.waitForTimeout(650);
    assert.equal(await visibleQuestion(card,questionnaire.questions[0].q).isVisible(),true,'Typing must cancel a pending radio advance');
    await custom().press('Enter');await visibleQuestion(card,questionnaire.questions[1].q).waitFor();

    await card.getByRole('checkbox',{name:'Image',exact:true}).check();
    await card.getByRole('checkbox',{name:'Vidéo',exact:true}).check();
    await custom().fill('Formats carrés et verticaux');
    await page.waitForTimeout(650);
    assert.equal(await visibleQuestion(card,questionnaire.questions[1].q).isVisible(),true,'Multiple choices wait for explicit Continue');
    await card.getByRole('button',{name:'Question précédente',exact:true}).click();
    await visibleQuestion(card,questionnaire.questions[0].q).waitFor();assert.equal(await custom().inputValue(),freeAnswer);
    await card.getByRole('button',{name:'Question suivante',exact:true}).click();
    await visibleQuestion(card,questionnaire.questions[1].q).waitFor();
    assert.equal(await card.getByRole('checkbox',{name:'Image',exact:true}).isChecked(),true);
    assert.equal(await card.getByRole('checkbox',{name:'Vidéo',exact:true}).isChecked(),true);
    assert.equal(await custom().inputValue(),'Formats carrés et verticaux');

    // Navigation and closing both cancel any delayed transition.
    await card.getByRole('button',{name:'Continuer',exact:true}).click();await visibleQuestion(card,questionnaire.questions[2].q).waitFor();
    await card.getByRole('radio',{name:'Direct',exact:true}).click();
    await card.getByRole('button',{name:'Question précédente',exact:true}).click();
    await page.waitForTimeout(650);assert.equal(await visibleQuestion(card,questionnaire.questions[1].q).isVisible(),true,'Going back cancels radio auto-advance');
    await card.getByRole('button',{name:'Question suivante',exact:true}).click();await visibleQuestion(card,questionnaire.questions[2].q).waitFor();
    await card.getByRole('radio',{name:'Chaleureux',exact:true}).click();
    await card.getByRole('button',{name:'Fermer les questions',exact:true}).click();
    await page.waitForTimeout(650);await card.getByRole('button',{name:'Reprendre les questions',exact:true}).click();
    assert.equal(await visibleQuestion(card,questionnaire.questions[2].q).isVisible(),true,'Hiding the card cancels radio auto-advance');
    assert.equal(await card.getByRole('radio',{name:'Chaleureux',exact:true}).isChecked(),true);

    // Passing is an explicit navigation action; the final radio never sends anything automatically.
    await card.getByRole('button',{name:'Passer',exact:true}).click();await visibleQuestion(card,questionnaire.questions[3].q).waitFor();
    assert.equal(await card.getByText(unsafe,{exact:true}).innerText(),unsafe);
    assert.equal(await card.locator('img,script').count(),0,'Question options remain escaped text');
    await custom().fill('Responsables de boutiques');await custom().press('Enter');
    assert.equal(await card.getByRole('button',{name:'Utiliser ces réponses',exact:true}).evaluate(element=>element===document.activeElement),true,'Enter in the last free answer only focuses the explicit final action');
    assert.equal(await composer.inputValue(),existingDraft,'Enter in a free answer cannot submit or prepare a draft automatically');
    await card.getByRole('radio',{name:'Professionnels',exact:true}).focus();await page.keyboard.press('Space');
    await page.waitForTimeout(650);
    assert.equal(await visibleQuestion(card,questionnaire.questions[3].q).isVisible(),true,'The final radio choice cannot auto-submit');
    assert.equal(await composer.inputValue(),existingDraft,'Answering must not alter the draft before explicit confirmation');
    assert.equal(mutations.length,0,'Answering cannot send chat, generate, approve, authorize or pay');
    await assertFits(page,card,`${width}px last question`);
    await card.scrollIntoViewIfNeeded();await settle(card);await page.screenshot({path:path.join(output,`brief-last-question-${width}.png`),fullPage:true});
    const useAnswers=card.getByRole('button',{name:'Utiliser ces réponses',exact:true});
    if(width===1280)await useAnswers.evaluate(button=>{button.click();button.click();});
    else{await useAnswers.focus();await page.keyboard.press('Enter');}
    await card.getByText('Réponses ajoutées au brouillon',{exact:true}).waitFor();
    const prepared=await composer.inputValue();
    assert.ok(prepared.startsWith(existingDraft),'Preparing answers appends to the existing draft');
    assert.equal(prepared.split(freeAnswer).length-1,1,'A rapid double click must prepare the answers only once');
    for(const answer of [freeAnswer,'Image','Vidéo','Formats carrés et verticaux','Professionnels'])assert.ok(prepared.includes(answer),`Prepared draft includes ${answer}`);
    assert.equal(await page.getByRole('button',{name:`Retirer ${file.title}`,exact:true}).count(),1,'Preparing answers preserves pending attachments');
    await page.waitForFunction(()=>document.activeElement===document.querySelector('.composer textarea'));
    assert.equal(await composer.evaluate(element=>element===document.activeElement),true,'Preparing answers returns focus to the composer');
    assert.equal(await page.evaluate(()=>window.__briefXss),undefined);
    assert.equal(mutations.length,0,'Using answers only prepares the draft');
    await card.scrollIntoViewIfNeeded();await settle(card);await page.screenshot({path:path.join(output,`brief-prepared-${width}.png`),fullPage:true});

    await card.getByRole('button',{name:'Recommencer',exact:true}).click();await visibleQuestion(card,questionnaire.questions[0].q).waitFor();
    assert.equal(await custom().inputValue(),'');
    assert.equal(await card.getByRole('radio',{name:'Faire connaître l’offre',exact:true}).isChecked(),false);
    assert.equal(await composer.inputValue(),prepared,'Restarting the card leaves the prepared draft untouched');
    await card.getByRole('radio',{name:'Obtenir des demandes',exact:true}).focus();await page.keyboard.press('Space');
    await visibleQuestion(card,questionnaire.questions[1].q).waitFor();
    await page.waitForFunction(()=>document.activeElement?.matches('input[type="checkbox"]'));
    assert.equal(await card.getByRole('checkbox',{name:'Image',exact:true}).evaluate(element=>element===document.activeElement),true,'Auto-advance focuses the next question');
    if(reducedMotion==='reduce'){
      const moving=await card.evaluate(element=>element.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'&&Number(animation.effect?.getTiming().duration)>0).length);
      assert.equal(moving,0,'Reduced motion has no animated card transitions');
    }
    checks.push(`${width}px: history restores questionnaire after reload; free text and multi choices survive navigation; editing, navigation and hiding cancel timers; last radio waits for explicit confirmation`);
    checks.push(`${width}px: keyboard confirmation appends all answers to the existing draft, preserves attachments and focuses the composer; restart is local; escaped text and no horizontal overflow`);
    if(width===1280){
      await page.getByRole('button',{name:'Nouvelle discussion',exact:true}).click();
      await composer.fill('Préparer un visuel ; le public reste à préciser.');
      await page.getByRole('button',{name:'Envoyer la demande',exact:true}).click();
      await card.getByText(questionnaire.title,{exact:true}).waitFor();
      await page.getByText('Précisons votre demande avant de poursuivre.',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Arrêter la réponse',exact:true}).waitFor({state:'hidden'});
      assert.equal(await card.count(),1,'Only a successful dedicated briefing tool may display a card');
      assert.equal(await page.getByText('Carte inattendue',{exact:true}).count(),0);
      assert.equal(await page.getByText('Carte en erreur',{exact:true}).count(),0);
      assert.equal(chatRequests.length,1,'Only the explicitly sent fixture request starts a local stream');
      for(let step=0;step<questionnaire.questions.length-1;step++)await card.getByRole('button',{name:'Question suivante',exact:true}).click();
      await card.getByRole('radio',{name:'Particuliers',exact:true}).check();
      await page.waitForTimeout(650);assert.equal(chatRequests.length,1);
      await card.getByRole('button',{name:'Utiliser ces réponses',exact:true}).click();
      await card.getByText('Réponses ajoutées au brouillon',{exact:true}).waitFor();
      assert.ok((await composer.inputValue()).includes('Particuliers'));
      assert.equal(chatRequests.length,1,'The live streamed card only prepares the next draft');
      checks.push('Live tool_result SSE restores the same card; applying its answer never starts another request');
    }
    await page.goto(origin+'/disabled-card');await card.waitFor();
    for(const control of await card.locator('input,button,textarea').all()){
      if(await control.getAttribute('aria-label')==='Fermer les questions')continue;
      assert.equal(await control.isDisabled(),true,'A disabled card cannot edit answers or advance');
    }
    assert.equal(await page.evaluate(()=>window.__disabledBriefSubmitted),undefined);
    checks.push(`${width}px: disabled card cannot edit, navigate, reset or apply answers`);
    await context.close();lastPage=null;
  }
  assert.equal(historyReads.length,4);assert.ok(historyReads.every(id=>id===conversation.id));
  assert.deepEqual(mutations,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(pageErrors,[]);
  assert.equal(chatRequests.length,1);
  checks.push('One explicitly sent local fixture stream; zero real model calls, API action mutations, external requests and unhandled browser errors');
  await writeFile(path.join(output,'results.json'),JSON.stringify({checks,measurements,historyReads:historyReads.length,localChatStreams:chatRequests.length,apiMutations:mutations.length,externalRequests:externalRequests.length,pageErrors},null,2));
  for(const check of checks)console.log('PASS '+check);
}catch(error){if(lastPage){await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error((await lastPage.locator('body').innerText()).slice(-1800));}throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
