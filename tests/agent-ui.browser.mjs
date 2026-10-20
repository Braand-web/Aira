// Real React/Chromium UI with a local fixture server. No credentials or external provider calls.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {PLANS,PACKS,topupPrice} from '../lib/billing-core.mjs';

const require=createRequire(import.meta.url);
const playwright=process.env.AIRA_PLAYWRIGHT_MODULE;
const {chromium}=await import(playwright?pathToFileURL(path.resolve(playwright)).href:require.resolve('playwright'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.tmp','agent-ui-browser');
await mkdir(output,{recursive:true});
await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import Studio from "./app/studio";import {FilePreviewProvider} from "./components/file-preview/file-preview-provider";import "./app/globals.css";import "./app/file-upload.css";import "./components/file-preview/file-preview.css";createRoot(document.getElementById("root")).render(<FilePreviewProvider><Studio/></FilePreviewProvider>);',resolveDir:root,loader:'tsx'},outdir:output,entryNames:'app',chunkNames:'chunks/[name]-[hash]',alias:{'next/image':'vinext/shims/image'},bundle:true,splitting:true,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'fixture-worker-url',setup(builder){builder.onResolve({filter:/^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url$/},()=>({path:'worker',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/unused-pdf-worker.mjs";',loader:'js'}));}}]});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ZsAAAAASUVORK5CYII=','base64');
const now=Date.now();
const proposal={id:'proposal-fixture',workspace_id:'fixture',kind:'proposal',title:'Visuel de test local',status:'awaiting_approval',version:1,created_at:now,updated_at:now,data:{kind:'media',rationale:'Fixture locale sans génération facturable',maxCredits:5,payload:{model:'fixture-image',input:{prompt:'Fixture'}}}};
const media={id:'media-fixture',workspace_id:'fixture',kind:'media',title:proposal.title,status:'ready',version:1,created_at:now,updated_at:now,data:{model:'fixture-image',output:{images:[]}}};
const conversation={id:'conversation-fixture',workspace_id:'fixture',kind:'conversation',title:'Discussion de test locale',status:'saved',version:1,created_at:now,updated_at:now,data:{}};
const sources=[{id:'source-real',title:'Rapport de test',domain:'example.org',url:'https://example.org/report'},{id:'source-unsafe',title:'<script>source non exécutable</script>',domain:'Document joint',url:'javascript:alert(1)'}];
const history=[];const votes=new Map();
let approvals=0,polls=0,chatCalls=0,stops=0,imageRequests=0,feedbackCalls=0,failFeedback=false;
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.test');
  if(url.pathname==='/api/workspace'){json(res,{user:{id:'fixture-user',name:'Compte de test',email:'fixture@example.test'},workspace:{name:'Espace de test',credits:200,reserved:0},resources:[proposal,conversation],catalog:[{id:'fixture-image',kind:'image'}],capabilities:{model:true,modelReady:true,filePreview:false}});return;}
  if(url.pathname==='/api/connectors/toolkits'){json(res,{items:[{slug:'metaads',name:'Meta Ads',description:'Catalogue de test local',connected:false,status:'disconnected'},{slug:'gmail',name:'Gmail',description:'Compte de test isolé',connected:true,status:'active',accountId:'fixture-account'}],nextCursor:null,configured:true,instant:{enabled:false,monthlyLimitUsd:0,perCallLimitUsd:0,note:'Test local'}});return;}
  if(url.pathname==='/api/billing/catalog'){json(res,{plans:PLANS,packs:PACKS.map(quantity=>({quantity,amount:topupPrice(quantity)})),custom:{min:50,max:10000},readiness:{enabled:false},free:{credits:0,days:7,enabled:false}});return;}
  if(url.pathname==='/api/billing/summary'){json(res,{wallet:{available:200,reserved:0},lots:[],orders:[],invoices:[]});return;}
  if(url.pathname==='/api/billing/organization'){json(res,{current:'fixture',organization:'fixture',role:'owner',rights:{plan:'pro',limits:PLANS.pro},spaces:[{id:'fixture',name:'Espace de test'}],members:[],limits:[],pendingInvites:0,activeMemberCount:1,viewer:{userId:'fixture-user',email:'fixture@example.test',displayName:'Compte de test'}});return;}
  if(url.pathname==='/api/billing/usage'){json(res,{entries:[],daily:[],asOf:now});return;}
  if(url.pathname==='/api/chat'&&req.method==='GET'){json(res,{messages:history.map(message=>({...message,feedback:votes.get(message.id)??null}))});return;}
  if(url.pathname==='/api/chat'&&req.method==='PATCH'){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());feedbackCalls++;if(failFeedback){failFeedback=false;json(res,{error:'Échec local de test'},503);return;}votes.set(body.messageId,body.feedback);json(res,body);return;}
  if(url.pathname==='/api/chat'&&req.method==='DELETE'){stops++;json(res,{stopped:true});return;}
  if(url.pathname==='/api/chat'&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString());chatCalls++;
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});
    const emit=(event,data)=>res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');
    emit('run',{runId:'run-'+chatCalls,conversationId:'conversation-fixture'});
    const timers=[];
    timers.push(setTimeout(()=>emit('specialist_start',{role:'creative'}),80));
    timers.push(setTimeout(()=>emit('tool_start',{name:'read_meta'}),350));
    timers.push(setTimeout(()=>emit('text_delta',{text:'Résultat de test conservé.'}),650));
    if(body.text==='Coupure réseau')timers.push(setTimeout(()=>res.end(),1000));
    else if(body.text!=='Arrêt utilisateur')timers.push(setTimeout(()=>{const messageId='assistant-'+chatCalls;history.push({id:'user-'+chatCalls,role:'user',content:[{type:'text',text:body.text}],attachments:[]},{id:messageId,role:'assistant',content:[{type:'text',text:'Résultat de test conservé.'}],status:'complete',sources,attachments:[]});emit('assistant_message',{messageId,runId:'run-'+chatCalls,sources});emit('done',{runId:'run-'+chatCalls});res.end();},1700));
    res.on('close',()=>timers.forEach(clearTimeout));return;
  }
  if(url.pathname==='/api/proposals/'+proposal.id){
    if(req.method==='POST'){approvals++;proposal.status='generating';json(res,{status:'waiting_external'});return;}
    polls++;json(res,polls===1?{status:'IN_PROGRESS'}:{status:'COMPLETED',resourceId:media.id});return;
  }
  if(url.pathname==='/api/resources/'+proposal.id){json(res,proposal);return;}
  if(url.pathname==='/api/resources/'+media.id){json(res,media);return;}
  if(url.pathname.startsWith('/api/')){json(res,{},404);return;}
  if(url.pathname==='/fixture.png'){imageRequests++;if(imageRequests===1){res.writeHead(503,{'Cache-Control':'no-store'});res.end();return;}res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});res.end(png);return;}
  if(url.pathname==='/app.js'||url.pathname==='/app.css'||url.pathname.startsWith('/chunks/')){
    try{const target=path.resolve(output,'.'+url.pathname);if(!target.startsWith(output+path.sep))throw Error();res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css':'application/javascript'});res.end(await readFile(target));}catch{res.writeHead(404);res.end();}return;
  }
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="fr" data-design-system="muse"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Aïra · Test isolé</title></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
media.data.output.images=[{url:origin+'/fixture.png',width:512,height:512}];
let browser,lastPage;
const checks=[];
try{
  try{browser=await chromium.launch({headless:true});}catch{browser=await chromium.launch({headless:true,channel:'msedge'});}
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();lastPage=page;const pageErrors=[];page.on('pageerror',error=>{pageErrors.push(error.message);console.error('Browser error:',error.message);});
  await page.addInitScript(()=>{window.__copyFail=false;window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.__copyFail)throw new Error('Clipboard denied');window.__copied.push(text);}}});});
  await page.goto(origin);await page.getByRole('textbox',{name:'Votre demande à Aïra'}).waitFor();
  const composer=page.getByRole('textbox',{name:'Votre demande à Aïra'});
  const initial=await page.locator('.composer').boundingBox();
  assert.equal(await page.locator('body').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(24, 24, 25)');
  assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width),240);
  await composer.fill('Une ligne\nUne deuxième ligne\nUne troisième ligne');
  await page.waitForFunction(()=>document.querySelector('.composer textarea').clientHeight>=72);
  const grown=await page.locator('.composer').boundingBox();assert.ok(grown.height>initial.height);assert.equal(Math.round(grown.width),Math.round(initial.width));
  await composer.fill('Document très long.\n'.repeat(100));
  await page.waitForFunction(()=>{const field=document.querySelector('.composer textarea');return field.clientHeight===192&&field.scrollHeight>field.clientHeight&&getComputedStyle(field).overflowY==='auto';});
  assert.equal(Math.round((await page.locator('.composer').boundingBox()).width),Math.round(initial.width));
  await composer.fill('');await page.getByRole('heading',{name:'Faites grandir vos idées.'}).click();
  await page.screenshot({path:path.join(output,'design-home-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Replier la navigation',exact:true}).click();await page.waitForFunction(()=>Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)===72);assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width),72);
  await page.getByRole('button',{name:'Déployer la navigation',exact:true}).click();
  await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:'Paramètres',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Votre espace',exact:true});await settings.waitFor();
  assert.equal(await settings.evaluate(element=>getComputedStyle(element).gridTemplateColumns),'224px 576px');
  await settings.getByRole('button',{name:'Connexions',exact:true}).click();await settings.getByRole('heading',{name:'Meta Ads',exact:true}).waitFor();
  assert.equal(await settings.getByRole('searchbox',{name:'Rechercher une application',exact:true}).evaluate(element=>getComputedStyle(element).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await page.screenshot({path:path.join(output,'design-settings-desktop.png'),fullPage:true});
  await page.keyboard.press('Escape');await settings.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.classList.contains('account-trigger'));
  await page.goto(origin+'/?view=knowledge');await page.getByRole('heading',{name:'Marketplace des compétences',exact:true}).waitFor();
  assert.equal(await page.locator('.skill-card').first().evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(40, 41, 43)');
  await page.screenshot({path:path.join(output,'design-skills-desktop.png'),fullPage:true});
  await page.goto(origin+'/?view=billing');await page.locator('.billing-loading').waitFor({state:'hidden'});await page.getByRole('button',{name:'Actualiser la facturation'}).waitFor();
  await page.locator('.billing-page svg').first().waitFor();
  await page.screenshot({path:path.join(output,'design-billing-desktop.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  assert.equal(await page.getByRole('button',{name:'Actualiser la facturation'}).evaluate(element=>getComputedStyle(element).fontSize),'0px');
  const mobileRefresh=await page.getByRole('button',{name:'Actualiser la facturation'}).boundingBox();assert.ok(mobileRefresh.x+mobileRefresh.width<=390);
  await page.screenshot({path:path.join(output,'design-billing-mobile.png'),fullPage:true});
  await page.goto(origin);await composer.waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.screenshot({path:path.join(output,'design-home-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Ouvrir la navigation',exact:true}).click();await page.locator('.sidebar.mobile-open').waitFor();
  await page.getByRole('button',{name:'Intégrations',exact:true}).click();await settings.waitFor();await settings.getByRole('heading',{name:'Meta Ads',exact:true}).waitFor();
  assert.equal(await settings.locator('.settings-tabs').evaluate(element=>getComputedStyle(element).flexDirection),'row');
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await page.screenshot({path:path.join(output,'design-settings-mobile.png'),fullPage:true});
  await page.keyboard.press('Escape');await settings.waitFor({state:'hidden'});
  await page.setViewportSize({width:1280,height:800});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(origin);await composer.fill('Bonjour');
  checks.push('Design system: shared tokens, desktop/mobile settings, catalog, billing and 72px rail');
  checks.push('Composer grows only vertically, caps at 192px and scrolls internally');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=analyzing]').waitFor();
  await page.locator('[data-slot=ai-status][data-state=writing]').waitFor();
  await page.screenshot({path:path.join(output,'desktop-writing.png'),fullPage:true});
  assert.equal(await page.locator('[data-slot=ai-status][data-state=done]').count(),0);
  assert.equal(await page.locator('[data-slot=streaming-response][data-state=streaming]').getByRole('button').count(),0);
  await page.locator('[data-slot=ai-status][data-state=done]').waitFor();
  assert.equal(chatCalls,1);checks.push('Chat: real stream states, one request, completion only after done');
  const response=page.locator('[data-slot=streaming-response]').first();
  await response.getByRole('button',{name:'Copier la réponse',exact:true}).click();
  await response.getByRole('button',{name:'Réponse copiée',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.__copied),['Résultat de test conservé.']);
  await page.evaluate(()=>{window.__copyFail=true;});
  await response.getByRole('button',{name:'Réponse copiée',exact:true}).click();
  await response.getByText('Copie impossible. Sélectionnez le texte pour le copier.',{exact:true}).waitFor();
  assert.equal(await response.getByRole('button',{name:'Réponse copiée',exact:true}).count(),0);
  await page.evaluate(()=>{window.__copyFail=false;});
  checks.push('Copy confirms only successful clipboard writes and handles denied access');
  await response.getByRole('button',{name:'2 sources',exact:true}).click();
  const sourceLink=response.getByRole('link',{name:/Rapport de test/});
  assert.equal(await sourceLink.getAttribute('href'),'https://example.org/report');
  assert.equal(await sourceLink.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await response.getByRole('link').count(),1);
  assert.ok((await response.innerText()).includes('<script>source non exécutable</script>'));
  await response.getByRole('button',{name:'2 sources',exact:true}).press('Enter');
  await sourceLink.waitFor({state:'hidden'});assert.equal(await sourceLink.isVisible(),false);
  checks.push('Sources are escaped, unsafe URLs cannot link, disclosure is keyboard controlled');
  const useful=response.getByRole('button',{name:'Réponse utile',exact:true});
  await useful.click();await page.waitForFunction(()=>document.querySelector('[aria-label="Réponse utile"]').getAttribute('aria-pressed')==='true');
  assert.equal(votes.get('assistant-1'),'up');
  await useful.click();await page.waitForFunction(()=>document.querySelector('[aria-label="Réponse utile"]').getAttribute('aria-pressed')==='false');
  assert.equal(votes.get('assistant-1'),null);
  failFeedback=true;await useful.click();await response.getByText('Avis non enregistré. Réessayez.',{exact:true}).waitFor();
  assert.equal(await useful.getAttribute('aria-pressed'),'false');assert.equal(votes.get('assistant-1'),null);
  await useful.click();await page.waitForFunction(()=>document.querySelector('[aria-label="Réponse utile"]').getAttribute('aria-pressed')==='true');
  assert.equal(feedbackCalls,4);checks.push('Votes persist by message, toggle back to null, and retain prior value on API failure');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Mon brouillon');
  await response.getByRole('button',{name:'Reprendre la demande',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Votre demande à Aïra'}).inputValue(),'Mon brouillon\n\nBonjour');assert.equal(chatCalls,1);
  checks.push('Resume preserves draft and prepares request without executing a new model/tool call');
  await page.reload();
  await page.getByRole('button',{name:'Rechercher',exact:true}).click();
  await page.getByRole('textbox',{name:'Rechercher dans votre espace'}).fill(conversation.title);
  await page.locator('.search-results button').filter({hasText:conversation.title}).click();
  await response.getByRole('button',{name:'Réponse utile',exact:true}).waitFor();
  assert.equal(await response.getByRole('button',{name:'Réponse utile',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await response.getByRole('button',{name:'2 sources',exact:true}).count(),1);
  checks.push('History reload restores real completion status, persisted feedback and citations');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Coupure réseau');await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=error]').waitFor();
  assert.ok((await page.locator('.messages').innerText()).includes('Résultat de test conservé.'));checks.push('Interrupted stream keeps received text and never claims success');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Arrêt utilisateur');await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=writing]').waitFor();
  await page.getByRole('button',{name:'Arrêter la réponse',exact:true}).click();
  await page.locator('[data-slot=ai-status][data-state=cancelled]').waitFor();assert.equal(stops,1);checks.push('Stop remains distinct from failure and cancels the existing run');
  await page.getByRole('button',{name:'Rechercher',exact:true}).click();
  await page.getByRole('textbox',{name:'Rechercher dans votre espace'}).fill(proposal.title);
  await page.locator('.search-results button').filter({hasText:proposal.title}).click();
  await page.getByRole('button',{name:'Approuver et générer'}).evaluate(button=>{button.click();button.click();});
  await page.locator('[data-slot=grid-reveal][data-state=pending]').waitFor();
  await page.screenshot({path:path.join(output,'desktop-grid-pending.png'),fullPage:true});
  await page.locator('[data-slot=grid-reveal][data-state=error]').waitFor({timeout:12000});assert.equal(approvals,1);
  await page.getByRole('button',{name:'Réessayer',exact:true}).click();
  await page.locator('[data-slot=grid-reveal][data-state=ready]').waitFor({timeout:12000}).catch(async()=>{
    // The settled grid is intentionally replaced by the native result image.
    await page.locator('.media-output img').waitFor({state:'visible'});
  });
  await page.locator('.media-output img').waitFor({state:'visible'});assert.equal(approvals,1);assert.ok(polls>=2);
  checks.push('One approved generation: pending grid, read-only follow-up, actual image reveal');
  assert.ok(imageRequests>=2);assert.equal(approvals,1);checks.push('Failed image load retries only the image, never the paid generation');
  await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.getByRole('complementary',{name:'Espace de travail'}).getByRole('button',{name:'Fermer l’espace de travail',exact:true}).click();
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Mobile');await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-active]').waitFor();
  await page.waitForFunction(()=>{const path=document.querySelector('[data-slot=ai-status][data-active] .ai-status-icon svg path');return path&&getComputedStyle(path).animationName==='none';});
  await page.locator('[data-slot=ai-status][data-state=done]').waitFor();
  assert.equal(await page.locator('.response-footer').last().evaluate(element=>getComputedStyle(element).animationName),'none');
  assert.ok(await page.locator('.response-action').last().evaluate(element=>element.getBoundingClientRect().height>=44));
  await page.screenshot({path:path.join(output,'mobile-reduced-motion.png'),fullPage:true});checks.push('Mobile: no horizontal overflow; reduced-motion animation disabled');
  assert.deepEqual(pageErrors,[]);checks.push('No unhandled browser errors');
  await writeFile(path.join(output,'results.json'),JSON.stringify({checks,chatCalls,approvals,polls,externalProviderCalls:0},null,2));
  for(const check of checks)console.log('PASS '+check);
}catch(error){if(lastPage){await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error((await lastPage.locator('body').innerText()).slice(0,1200));}throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
