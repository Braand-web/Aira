// Real React/Chromium UI with a local fixture server. No credentials or external provider calls.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {CATALOG_VERSION,PLANS,PACKS,topupPrice,quoteTax} from '../lib/billing-core.mjs';

const require=createRequire(import.meta.url);
const playwright=process.env.AIRA_PLAYWRIGHT_MODULE;
const {chromium}=await import(playwright?pathToFileURL(path.resolve(playwright)).href:require.resolve('playwright'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'.tmp','agent-ui-browser');
await mkdir(output,{recursive:true});
await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import Studio from "./app/studio";import {FilePreviewProvider} from "./components/file-preview/file-preview-provider";import "./app/globals.css";import "./app/file-upload.css";import "./components/file-preview/file-preview.css";createRoot(document.getElementById("root")).render(<FilePreviewProvider><Studio/></FilePreviewProvider>);',resolveDir:root,loader:'tsx'},outdir:output,entryNames:'app',chunkNames:'chunks/[name]-[hash]',alias:{'next/image':'vinext/shims/image'},bundle:true,splitting:true,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'fixture-worker-url',setup(builder){builder.onResolve({filter:/^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url$/},()=>({path:'worker',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/unused-pdf-worker.mjs";',loader:'js'}));}}]});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ZsAAAAASUVORK5CYII=','base64');
const now=Date.now();
// Explicit test fixture only: this is not a production tax determination.
const taxRule={mode:'exclusive',rateBps:1925,jurisdiction:'fixture:CM-only',version:'fixture-tax-v1',validatedAt:'2026-10-22'};
const money=value=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value)+' FCFA';
const proposal={id:'proposal-fixture',workspace_id:'fixture',kind:'proposal',title:'Visuel de test local',status:'awaiting_approval',version:1,created_at:now,updated_at:now,data:{kind:'media',rationale:'Fixture locale sans génération facturable',maxCredits:5,payload:{model:'fixture-image',input:{prompt:'Fixture'}}}};
const media={id:'media-fixture',workspace_id:'fixture',kind:'media',title:proposal.title,status:'ready',version:1,created_at:now,updated_at:now,data:{model:'fixture-image',output:{images:[]}}};
const conversation={id:'conversation-fixture',workspace_id:'fixture',kind:'conversation',title:'Discussion de test locale',status:'saved',version:1,created_at:now,updated_at:now,data:{}};
const sources=[{id:'source-real',title:'Rapport de test',domain:'example.org',url:'https://example.org/report'},{id:'source-unsafe',title:'<script>source non exécutable</script>',domain:'Document joint',url:'javascript:alert(1)'}];
const history=[];const votes=new Map();
const workspaceResources=[proposal,conversation],workspaceMutations=[];
let approvals=0,polls=0,chatCalls=0,stops=0,imageRequests=0,feedbackCalls=0,failFeedback=false;
let workspaceReads=0,summaryReads=0,walletAvailable=200;
let checkoutCalls=0,billingEnabled=false;
const quoteRequests=[],orderVerificationRequests=[];
const organizationMutations=[];
const catalogRequests=[],authorizationRequests=[],revocationRequests=[];
const connectedAccounts=new Set(['gmail','slack']);
const connectorFixtures=[{slug:'metaads',name:'Meta Ads',description:'Catalogue de test local',connected:false,status:'disconnected'},{slug:'gmail',name:'Gmail',description:'Compte de test isolé',connected:true,status:'active',accountId:'fixture-gmail'},{slug:'slack',name:'Slack',description:'Deuxième page de connexions de test',connected:true,status:'active',accountId:'fixture-slack'}];
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.test');
  if(url.pathname==='/api/workspace'&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());workspaceMutations.push(body);
    const created={id:'fixture-imported-skill',workspace_id:'fixture',kind:body.kind,title:body.title,status:'candidate',version:1,created_at:now,updated_at:now,data:body.data};workspaceResources.push(created);json(res,created);return;
  }
  if(url.pathname==='/api/workspace'){workspaceReads++;json(res,{user:{id:'fixture-user',name:'Compte de test',email:'fixture@example.test'},workspace:{id:'fixture',name:'Espace de test',credits:walletAvailable+12,reserved:12},resources:workspaceResources,catalog:[{id:'fixture-image',kind:'image'}],capabilities:{model:true,modelReady:true,filePreview:false}});return;}
  if(url.pathname==='/api/connectors/toolkits'){
    catalogRequests.push({connected:url.searchParams.get('connected'),search:url.searchParams.get('search'),cursor:url.searchParams.get('cursor')});
    const query=(url.searchParams.get('search')||'').toLowerCase(),connected=url.searchParams.get('connected')==='true',cursor=url.searchParams.get('cursor');
    const matches=connectorFixtures.map(item=>({...item,connected:connectedAccounts.has(item.slug),status:connectedAccounts.has(item.slug)?'active':'disconnected'})).filter(item=>(!connected||item.connected)&&(!query||item.name.toLowerCase().includes(query)));
    const paginated=connected&&!query&&matches.length>1;
    const items=paginated?(cursor==='fixture-connected-2'?matches.slice(1):matches.slice(0,1)):matches;
    json(res,{items,nextCursor:paginated&&!cursor?'fixture-connected-2':null,configured:true,instant:{enabled:false,monthlyLimitUsd:0,perCallLimitUsd:0,note:'Test local'}});return;
  }
  if(url.pathname==='/api/connectors/authorize'&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());authorizationRequests.push(body);
    json(res,{redirectUrl:'https://connect.composio.dev/fixture-authorization'});return;
  }
  if(url.pathname.startsWith('/api/connectors/accounts/')&&req.method==='DELETE'){
    const accountId=decodeURIComponent(url.pathname.split('/').at(-1));revocationRequests.push(accountId);const item=connectorFixtures.find(item=>item.accountId===accountId);if(item)connectedAccounts.delete(item.slug);
    json(res,{disconnected:true});return;
  }
  if(url.pathname==='/api/billing/catalog'){json(res,{version:CATALOG_VERSION,currency:'XAF',plans:PLANS,packs:PACKS.map(quantity=>({quantity,amount:topupPrice(quantity)})),custom:null,cycles:['period'],annualAvailable:false,tax:{configured:true,...taxRule},readiness:{enabled:billingEnabled},free:{credits:10,days:7,enabled:false}});return;}
  if(url.pathname==='/api/billing/summary'){summaryReads++;json(res,{wallet:{available:walletAvailable,reserved:12},creditAllowance:PLANS.pro.credits,subscription:null,meters:{storage:10*1024*1024,transfer:20*1024*1024},lots:[],orders:[],invoices:[]});return;}
  if(url.pathname==='/api/billing/organization'){
    if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);organizationMutations.push(JSON.parse(Buffer.concat(chunks).toString()));json(res,{error:'Le test interdit les mutations d’équipe'},403);return;}
    json(res,{current:'fixture',organization:'fixture-org',role:'owner',rights:{plan:'business',limits:PLANS.business},spaces:[{id:'fixture',name:'Espace de test',organization_id:'fixture-org',organization_name:'Organisation de test'}],members:[{user_id:'fixture-user',role:'owner',active:1},{user_id:'fixture-reader',role:'reader',active:1,name:'Lecteur de test'}],limits:[],pendingInvites:0,activeMemberCount:2,viewer:{userId:'fixture-user',email:'fixture@example.test',displayName:'Compte de test'}});return;
  }
  if(url.pathname==='/api/billing/usage'){json(res,{entries:[],daily:[],asOf:now});return;}
  if(url.pathname==='/api/billing/price'){json(res,{amount:topupPrice(Number(url.searchParams.get('quantity')))});return;}
  if(url.pathname==='/api/billing/quotes'&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());quoteRequests.push(body);
    const credits=body.kind==='topup'?body.quantity:PLANS[body.plan||'pro'].credits;
    if(body.kind==='subscription'&&body.cycle!=='period'){json(res,{error:'La fixture interdit les nouvelles ventes annuelles'},409);return;}
    const amount=body.kind==='topup'?topupPrice(credits):PLANS[body.plan||'pro'].periodPrice;
    json(res,{id:'fixture-quote',...body,...quoteTax(amount,taxRule),credits,units:credits*100,expiresAt:Date.now()+300000,eligible:false});return;
  }
  if(url.pathname==='/api/billing/checkout'){checkoutCalls++;json(res,{error:'Le test interdit toute tentative de paiement'},403);return;}
  if(url.pathname.startsWith('/api/billing/orders/')&&req.method==='GET'){
    orderVerificationRequests.push({id:decodeURIComponent(url.pathname.split('/').at(-1)),verify:url.searchParams.get('verify')});
    json(res,{id:'fixture-return-order',amount:5963,product:JSON.stringify({kind:'topup',quantity:125}),created_at:now,status:'pending'});return;
  }
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
    else if(body.text!=='Arrêt utilisateur')timers.push(setTimeout(()=>{if(body.text==='Bonjour')walletAvailable=195;const messageId='assistant-'+chatCalls;history.push({id:'user-'+chatCalls,role:'user',content:[{type:'text',text:body.text}],attachments:[]},{id:messageId,role:'assistant',content:[{type:'text',text:'Résultat de test conservé.'}],status:'complete',sources,attachments:[]});emit('assistant_message',{messageId,runId:'run-'+chatCalls,sources});emit('done',{runId:'run-'+chatCalls});res.end();},body.text==='Bonjour'?3500:1700));
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
  const capture=async options=>{
    await page.locator('dialog[open]').evaluateAll(async dialogs=>{
      await Promise.all(dialogs.flatMap(dialog=>dialog.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    });
    await page.screenshot(options);
  };
  await page.addInitScript(()=>{window.__copyFail=false;window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(window.__copyFail)throw new Error('Clipboard denied');window.__copied.push(text);}}});});
  await page.goto(origin);await page.getByRole('textbox',{name:'Votre demande à Aïra'}).waitFor();
  await page.locator('.welcome-symbol canvas[data-bot-avatar="clover"][data-state="default"]').waitFor();
  const composer=page.getByRole('textbox',{name:'Votre demande à Aïra'});
  const initial=await page.locator('.composer').boundingBox();
  assert.equal(await page.locator('body').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(24, 24, 25)');
  assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width),240);
  assert.equal(await page.locator('.sidebar').getByRole('button',{name:'Intégrations',exact:true}).count(),0);
  assert.equal(await page.locator('.sidebar').getByRole('button',{name:'Compétences',exact:true}).count(),0);
  await composer.fill('Une ligne\nUne deuxième ligne\nUne troisième ligne');
  await page.waitForFunction(()=>document.querySelector('.composer textarea').clientHeight>=72);
  const grown=await page.locator('.composer').boundingBox();assert.ok(grown.height>initial.height);assert.equal(Math.round(grown.width),Math.round(initial.width));
  await composer.fill('Document très long.\n'.repeat(100));
  await page.waitForFunction(()=>{const field=document.querySelector('.composer textarea');return field.clientHeight===192&&field.scrollHeight>field.clientHeight&&getComputedStyle(field).overflowY==='auto';});
  assert.equal(Math.round((await page.locator('.composer').boundingBox()).width),Math.round(initial.width));
  await composer.fill('');await page.getByRole('heading',{name:'Faites grandir vos idées.'}).click();
  await capture({path:path.join(output,'design-home-desktop.png'),fullPage:true});
  const assertAccountMenuVisible=async()=>{const menu=page.getByRole('menu',{name:'Menu du compte',exact:true});await menu.waitFor();await page.waitForFunction(()=>{const menu=document.querySelector('[role=menu][aria-label="Menu du compte"]');return menu&&getComputedStyle(menu).opacity==='1';});const bounds=await menu.boundingBox(),viewport=page.viewportSize();assert.ok(bounds.x>=8,'Account menu must stay inside the left viewport edge');assert.ok(bounds.y>=8,'Account menu must stay inside the top viewport edge');assert.ok(bounds.x+bounds.width<=viewport.width-8,'Account menu must stay inside the right viewport edge');assert.ok(bounds.y+bounds.height<=viewport.height-8,'Account menu must stay inside the bottom viewport edge');return menu;};
  await page.getByRole('button',{name:'Replier la navigation',exact:true}).click();await page.waitForFunction(()=>Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)===72);assert.equal(Math.round((await page.locator('.sidebar').boundingBox()).width),72);
  await page.locator('.account-trigger').click();await assertAccountMenuVisible();await page.locator('.account-trigger').click();
  await page.getByRole('button',{name:'Déployer la navigation',exact:true}).click();
  await composer.fill('Brouillon conservé pendant les paramètres');
  await page.locator('.account-trigger').click();await assertAccountMenuVisible();await capture({path:path.join(output,'design-account-menu-desktop.png'),fullPage:true});await page.getByRole('menuitem',{name:'Paramètres',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Paramètres',exact:true});await settings.waitFor();
  assert.equal(await settings.locator('.settings-shell').evaluate(element=>getComputedStyle(element).gridTemplateColumns),'224px 656px');
  for(const label of ['Général','Connecteurs','Compétences','Portefeuille','Facturation','Équipe et budgets','Stockage','Autorisations','Aide et raccourcis'])assert.equal(await settings.locator('.settings-navigation').getByRole('button',{name:label,exact:true}).count(),1);
  await settings.getByRole('heading',{name:'Général',exact:true}).waitFor();
  await settings.getByText('fixture@example.test',{exact:true}).waitFor();
  await settings.getByText('Compte de test',{exact:true}).waitFor();
  await settings.getByText('Espace de test',{exact:true}).waitFor();
  await settings.getByText('200 crédits',{exact:true}).waitFor();
  await settings.getByText('12 réservés',{exact:true}).waitFor();
  await capture({path:path.join(output,'design-settings-general-desktop.png'),fullPage:true});
  await settings.locator('.settings-navigation').getByRole('button',{name:'Aide et raccourcis',exact:true}).click();
  await settings.getByRole('heading',{name:'Raccourcis clavier',exact:true}).waitFor();
  await settings.locator('.settings-navigation').getByRole('button',{name:'Portefeuille',exact:true}).click();
  await settings.getByText('250 crédits',{exact:true}).waitFor();
  await settings.getByText('12 crédits',{exact:true}).waitFor();
  await settings.locator('.settings-navigation').getByRole('button',{name:'Stockage',exact:true}).click();await settings.getByRole('heading',{name:'Utilisation',exact:true}).waitFor();
  assert.match(await settings.locator('.settings-storage').innerText(),/^10 Mo sur /);
  assert.equal(await settings.getByRole('progressbar',{name:'Stockage utilisé',exact:true}).getAttribute('aria-valuenow'),String(10*1024*1024));
  assert.equal(await settings.getByRole('progressbar',{name:'Stockage utilisé',exact:true}).getAttribute('aria-valuemax'),String(PLANS.business.storage));
  assert.match(await settings.locator('.settings-content').innerText(),/20 Mo sur /);
  await settings.locator('.settings-navigation').getByRole('button',{name:'Autorisations',exact:true}).click();await settings.getByText('Propriétaire',{exact:true}).waitFor();await settings.getByText('Business',{exact:true}).waitFor();
  assert.equal(await settings.locator('.settings-content').getByRole('switch').count(),0,'Authorization policies must not expose fake permission switches');
  checks.push('Compact sidebar moves all nine management sections into settings with real storage and role values');
  await settings.locator('.settings-navigation').getByRole('button',{name:'Connecteurs',exact:true}).click();await settings.getByRole('button',{name:'Activer Meta Ads',exact:true}).waitFor();
  assert.equal(await settings.getByRole('searchbox',{name:'Rechercher une application',exact:true}).evaluate(element=>getComputedStyle(element).backgroundColor),'rgba(0, 0, 0, 0)');
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await capture({path:path.join(output,'design-settings-desktop.png'),fullPage:true});
  assert.equal(await settings.getByRole('button',{name:'Disponible',exact:true}).getAttribute('aria-pressed'),'true');
  const metaTrigger=settings.getByRole('button',{name:'Découvrir Meta Ads',exact:true});
  await metaTrigger.click();const metaDetail=page.getByRole('dialog',{name:'Meta Ads',exact:true});await metaDetail.waitFor();
  assert.equal(authorizationRequests.length,0,'Opening a connector must not request authorization');
  assert.equal(revocationRequests.length,0);
  await capture({path:path.join(output,'design-connector-detail-desktop.png'),fullPage:true});
  await page.keyboard.press('Escape');await metaDetail.waitFor({state:'hidden'});assert.equal(await settings.isVisible(),true);
  assert.equal(await metaTrigger.evaluate(element=>element===document.activeElement),true,'Closing a connector returns focus to its trigger');
  await metaTrigger.click();await metaDetail.waitFor();
  await metaDetail.getByRole('button',{name:'Connecter',exact:true}).evaluate(button=>{button.click();button.click();});
  const authorize=metaDetail.getByRole('link',{name:'Autoriser Meta Ads',exact:true});await authorize.waitFor();
  assert.deepEqual(authorizationRequests,[{toolkit:'metaads'}]);
  assert.equal(await authorize.getAttribute('href'),'https://connect.composio.dev/fixture-authorization');
  assert.equal(await authorize.getAttribute('target'),'_blank');assert.equal(await authorize.getAttribute('rel'),'noopener noreferrer');
  assert.equal(context.pages().length,1,'OAuth must remain an explicit user-controlled link');
  for(const action of await metaDetail.locator('button,a').all()){
    const bounds=await action.boundingBox(),label=await action.getAttribute('aria-label')||await action.innerText();
    assert.ok(bounds.height>=44,`Connector dialog action “${label}” needs a 44px touch target; got ${bounds.height}px`);
  }
  // Simulate an OAuth grant at the fixture boundary; no authorization page is opened.
  connectedAccounts.add('metaads');
  await metaDetail.getByRole('button',{name:'Actualiser après la connexion',exact:true}).click();await metaDetail.waitFor({state:'hidden'});
  await settings.getByRole('button',{name:'Voir Meta Ads',exact:true}).waitFor();
  assert.equal(await settings.getByRole('button',{name:'Disponible',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await settings.getByRole('searchbox',{name:'Rechercher une application',exact:true}).inputValue(),'Meta Ads');
  assert.ok(catalogRequests.some(request=>request.search==='Meta Ads'&&request.connected===null&&request.cursor===null));
  await settings.getByText('Consultez l’état de Meta Ads dans les résultats actualisés.',{exact:true}).waitFor();
  assert.deepEqual(authorizationRequests,[{toolkit:'metaads'}],'Refreshing an OAuth result must not authorize or mutate the account again');
  connectedAccounts.delete('metaads');await settings.getByRole('button',{name:'Actualiser les connexions',exact:true}).click();await settings.getByRole('button',{name:'Activer Meta Ads',exact:true}).waitFor();
  await settings.getByRole('searchbox',{name:'Rechercher une application',exact:true}).fill('');await settings.getByRole('button',{name:'Voir Gmail',exact:true}).waitFor();
  await settings.getByRole('button',{name:'Connecté',exact:true}).click();await settings.getByRole('button',{name:'Voir Gmail',exact:true}).waitFor();
  assert.equal(await settings.getByRole('button',{name:'Connecté',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await settings.getByRole('button',{name:'Activer Meta Ads',exact:true}).count(),0);
  assert.equal(await settings.getByRole('button',{name:'Voir Slack',exact:true}).count(),0,'The connected fixture starts with one server page');
  await settings.getByRole('button',{name:'Afficher d’autres applications',exact:true}).click();await settings.getByRole('button',{name:'Voir Slack',exact:true}).waitFor();
  assert.ok(catalogRequests.some(request=>request.connected==='true'&&request.cursor==='fixture-connected-2'),'Connected filtering must be sent on pagination');
  const connectorSearch=settings.getByRole('searchbox',{name:'Rechercher une application',exact:true});
  await connectorSearch.fill('Slack');await settings.getByRole('button',{name:'Voir Slack',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.connectors-results')?.getAttribute('aria-busy')==='false');
  assert.equal(await settings.getByRole('button',{name:'Voir Gmail',exact:true}).count(),0);
  assert.ok(catalogRequests.some(request=>request.connected==='true'&&request.search==='Slack'&&request.cursor===null),'Search remains server-filtered within connected accounts');
  await connectorSearch.fill('');await settings.getByRole('button',{name:'Voir Gmail',exact:true}).waitFor();
  await settings.getByRole('button',{name:'Voir Gmail',exact:true}).click();const gmailDetail=page.getByRole('dialog',{name:'Gmail',exact:true});await gmailDetail.waitFor();
  await gmailDetail.getByRole('button',{name:'Déconnecter Gmail',exact:true}).click();
  assert.equal(revocationRequests.length,0,'The first disconnect action only asks for confirmation');
  await gmailDetail.getByRole('button',{name:'Annuler',exact:true}).click();assert.equal(revocationRequests.length,0);
  await gmailDetail.getByRole('button',{name:'Déconnecter Gmail',exact:true}).click();
  await gmailDetail.getByRole('button',{name:'Confirmer la déconnexion',exact:true}).evaluate(button=>{button.click();button.click();});
  await gmailDetail.waitFor({state:'hidden'});await settings.getByRole('button',{name:'Voir Slack',exact:true}).waitFor();
  assert.deepEqual(revocationRequests,['fixture-gmail']);assert.equal(await settings.getByRole('button',{name:'Voir Gmail',exact:true}).count(),0);
  checks.push('Settings show real account, wallet, storage and shortcuts without invented subscription prices');
  checks.push('Connector discovery is read-only; authorization needs one explicit click and a safe user-controlled OAuth link');
  checks.push('OAuth refresh closes the stale dialog and fetches the selected application by name without another authorization');
  checks.push('Connected catalog uses server-side search and pagination; disconnect requires confirmation and prevents double submission');
  checks.push('Nested connector dialog closes independently and restores focus to the originating card');
  await page.keyboard.press('Escape');await settings.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.classList.contains('account-trigger'));
  assert.equal(await composer.inputValue(),'Brouillon conservé pendant les paramètres');await composer.fill('');
  await page.goto(origin+'/?view=analytics');await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:'Paramètres',exact:true}).click();await settings.waitFor();
  await settings.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();await settings.waitFor({state:'hidden'});assert.equal(new URL(page.url()).searchParams.get('view'),'analytics');
  checks.push('Opening settings preserves the composer draft and current analytics route');
  const workspaceReadsBeforeSwitch=workspaceReads,mutationsBeforeSwitch={chatCalls,approvals,authorizationCalls:authorizationRequests.length,revocationCalls:revocationRequests.length};
  const reloadedWorkspace=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/workspace'&&response.request().method()==='GET');
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'aira.workspace',oldValue:'fixture',newValue:'fixture-other',storageArea:localStorage,url:location.href})))]);
  await reloadedWorkspace;assert.ok(workspaceReads>workspaceReadsBeforeSwitch);assert.equal(new URL(page.url()).searchParams.get('view'),'analytics');
  assert.deepEqual({chatCalls,approvals,authorizationCalls:authorizationRequests.length,revocationCalls:revocationRequests.length},mutationsBeforeSwitch);
  checks.push('A workspace change in another tab reloads its snapshot without running model, generation or connector mutations');
  await page.goto(origin+'/?view=knowledge');await settings.waitFor();await settings.getByRole('heading',{name:'Compétences',exact:true}).waitFor();
  assert.equal(await settings.locator('.skill-card').first().evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(40, 41, 43)');
  await capture({path:path.join(output,'design-skills-desktop.png'),fullPage:true});
  const skillChooserPromise=page.waitForEvent('filechooser');await settings.getByRole('button',{name:'Importer une compétence',exact:true}).click();const skillChooser=await skillChooserPromise;
  await skillChooser.setFiles({name:'methode-test-locale.md',mimeType:'text/markdown',buffer:Buffer.from('# Méthode de test locale\nUne méthode strictement fictive.\n## Étapes\n- Lire le contexte\n## Vérifications\n- Demander les preuves')});
  const importedSkill=settings.locator('.skill-card').filter({has:page.getByRole('heading',{name:'Méthode de test locale',exact:true})});await importedSkill.waitFor();
  assert.equal(workspaceMutations.length,1);assert.equal(workspaceMutations[0].kind,'skill');
  await importedSkill.getByRole('button',{name:'Utiliser',exact:true}).click();await settings.waitFor({state:'hidden'});await composer.waitFor();
  assert.match(await composer.inputValue(),/Méthode de test locale/);assert.match(await composer.inputValue(),/Lire le contexte/);assert.equal(chatCalls,0,'Using a skill prepares a draft without executing the agent');await composer.fill('');
  checks.push('Skills stay available in settings: import stores a private method and Use prepares the chat without execution');
  await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:/Crédits et facturation/}).click();await settings.waitFor();
  await settings.getByRole('heading',{name:'Facturation',exact:true}).waitFor();await settings.locator('.billing-loading').waitFor({state:'hidden'});await settings.getByRole('button',{name:'Actualiser la facturation',exact:true}).waitFor();
  const billingNavigation=settings.getByRole('navigation',{name:'Rubriques de facturation',exact:true});
  const embeddedBilling=settings.getByRole('region',{name:'Forfaits et crédits',exact:true});await embeddedBilling.waitFor();
  const assertQuoteTax=async(baseAmount)=>{
    const expected=quoteTax(baseAmount,taxRule);
    for(const [label,value] of [['Sous-total hors taxes',expected.subtotal],['Taxes · fixture:CM-only · 19,25 %',expected.tax],['Total à payer',expected.total]]){
      const term=embeddedBilling.getByText(label,{exact:true});await term.waitFor();
      assert.equal(await term.locator('..').locator('dd').innerText(),money(value),`The server ${label} must be displayed before payment confirmation`);
    }
    assert.equal(await settings.getByRole('button',{name:'Accepter le total et continuer vers le paiement',exact:true}).isDisabled(),true,'An ineligible quote must never permit checkout');
    assert.equal(checkoutCalls,0);
  };
  assert.deepEqual(await billingNavigation.getByRole('button').allTextContents(),['Forfait','Recharger','Paiements']);
  assert.equal(await billingNavigation.getByRole('button',{name:'Paiements',exact:true}).getAttribute('aria-current'),'page');
  assert.equal(await settings.locator('.billing-heading h1').count(),0,'Embedded billing must not render the central-page hero');
  await billingNavigation.getByRole('button',{name:'Forfait',exact:true}).click();await settings.getByRole('button',{name:'Choisir Pro',exact:true}).waitFor();
  for(const name of ['Essentiel','Pro','Business'])assert.equal(await embeddedBilling.getByRole('heading',{name,exact:true}).count(),1);
  assert.equal(await embeddedBilling.getByRole('button',{name:/^Choisir (Essentiel|Pro|Business)$/}).count(),3);
  assert.equal(await embeddedBilling.getByRole('button',{name:/^(Annuel|12 mois)$/}).count(),0,'Annual sales must remain unavailable');
  await embeddedBilling.getByText('Pour 30 jours · hors taxes',{exact:true}).waitFor();
  for(const amount of [4900,9900,24900])assert.equal(await embeddedBilling.getByText(money(amount),{exact:true}).count(),1);
  const planCarousel=embeddedBilling.getByRole('region',{name:'Forfaits disponibles',exact:true});
  const previousPlans=embeddedBilling.getByRole('button',{name:'Forfaits précédents',exact:true}),nextPlans=embeddedBilling.getByRole('button',{name:'Forfaits suivants',exact:true});
  const planLayout=()=>planCarousel.evaluate(element=>{
    const viewport=element.getBoundingClientRect();
    return {width:viewport.width,scroll:element.scrollLeft,cards:Array.from(element.children,card=>{const bounds=card.getBoundingClientRect();return {width:bounds.width,visible:Math.max(0,Math.min(bounds.right,viewport.right)-Math.max(bounds.left,viewport.left))};})};
  });
  const waitForLastPlan=()=>page.waitForFunction(()=>{
    const carousel=document.querySelector('[aria-label="Forfaits disponibles"]'),last=carousel?.lastElementChild;
    if(!carousel||!last)return false;
    const viewport=carousel.getBoundingClientRect(),card=last.getBoundingClientRect();
    return card.left>=viewport.left-1&&card.right<=viewport.right+1;
  });
  const desktopPlans=await planLayout();
  assert.equal(desktopPlans.cards.filter(card=>card.visible>=card.width-1).length,2,'Desktop shows two complete plan cards');
  assert.ok(desktopPlans.cards[2].visible>0&&desktopPlans.cards[2].visible<desktopPlans.cards[2].width,'A sliver of the third plan reveals the horizontal comparison');
  assert.equal(await previousPlans.isDisabled(),true);assert.equal(await nextPlans.isDisabled(),false);
  await capture({path:path.join(output,'billing-offers-desktop.png'),fullPage:true});
  await nextPlans.click();await waitForLastPlan();
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Forfaits suivants"]').disabled);
  assert.equal(await previousPlans.isDisabled(),false);
  await capture({path:path.join(output,'billing-offers-desktop-last.png'),fullPage:true});
  await planCarousel.focus();await planCarousel.press('Home');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Forfaits disponibles"]').scrollLeft<1);
  await planCarousel.press('ArrowRight');await waitForLastPlan();
  await planCarousel.press('Home');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Forfaits disponibles"]').scrollLeft<1);
  await planCarousel.hover();await page.mouse.wheel(400,0);await waitForLastPlan();
  await previousPlans.click();await page.waitForFunction(()=>document.querySelector('[aria-label="Forfaits disponibles"]').scrollLeft<1);
  checks.push('Plan comparison shows two complete desktop cards and a preview of the third; arrows, keyboard and trackpad reveal the last plan without a purchase');
  assert.equal(await embeddedBilling.locator('svg circle[cx="200"][cy="200"][r="150"]').count(),0,'Embedded plan comparison omits the large credits dial');
  assert.equal(quoteRequests.length,0);assert.equal(checkoutCalls,0);
  assert.equal(await settings.getByRole('button',{name:'Choisir Pro',exact:true}).isDisabled(),true,'Unconfigured payment providers must keep plan selection disabled');
  // Enable only the loopback fixture to exercise quote creation. Checkout remains forbidden.
  billingEnabled=true;await settings.getByRole('button',{name:'Actualiser la facturation',exact:true}).click();
  await settings.getByRole('button',{name:'Choisir Pro',exact:true}).click();await settings.getByRole('heading',{name:'Votre récapitulatif',exact:true}).waitFor();
  assert.deepEqual(quoteRequests,[{kind:'subscription',plan:'pro',cycle:'period'}]);assert.equal(checkoutCalls,0,'A quote must never open checkout before an explicit payment confirmation');
  assert.equal(await settings.getByRole('button',{name:'Accepter le total et continuer vers le paiement',exact:true}).isDisabled(),true,'The launch gate stays enforced in embedded billing');
  await assertQuoteTax(9900);await capture({path:path.join(output,'billing-tax-review-desktop.png'),fullPage:true});
  await settings.getByRole('button',{name:'Revenir',exact:true}).click();await billingNavigation.getByRole('button',{name:'Recharger',exact:true}).click();
  assert.equal(await embeddedBilling.getByRole('button',{name:/crédits/}).count(),3,'Only the three catalogue recharge packs are available');
  assert.equal(await embeddedBilling.getByRole('spinbutton').count(),0,'Custom recharge quantities must not be offered');
  assert.equal(await embeddedBilling.getByText('Autre quantité',{exact:true}).count(),0);
  const pack125=embeddedBilling.getByRole('button',{name:/125 crédits/});assert.equal(await pack125.getAttribute('aria-pressed'),'true');assert.ok((await pack125.innerText()).includes(money(5000)));
  await embeddedBilling.getByRole('button',{name:'Vérifier le récapitulatif',exact:true}).click();await assertQuoteTax(5000);
  assert.deepEqual(quoteRequests.at(-1),{kind:'topup',quantity:125});
  checks.push('Three 30-day offers and three packs expose no annual or custom sales; exact server subtotal, tax and total precede approval');
  billingEnabled=false;await settings.getByRole('button',{name:'Revenir',exact:true}).click();await billingNavigation.getByRole('button',{name:'Paiements',exact:true}).click();await settings.getByRole('button',{name:'Actualiser la facturation',exact:true}).click();await settings.getByText('Paiements indisponibles',{exact:true}).waitFor();
  await capture({path:path.join(output,'design-billing-desktop.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await settings.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();await settings.waitFor({state:'hidden'});await composer.waitFor();
  await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:'Changer d’espace',exact:true}).click();await settings.waitFor();await settings.getByRole('heading',{name:'Équipe et budgets',exact:true}).waitFor();
  await settings.getByRole('heading',{name:'Membres de l’organisation',exact:true}).waitFor();await settings.getByText('Lecteur de test',{exact:true}).waitFor();await settings.getByText('Propriétaire',{exact:true}).waitFor();
  assert.equal(await settings.getByRole('button',{name:'Créer l’invitation',exact:true}).isDisabled(),true);assert.equal(organizationMutations.length,0);
  await capture({path:path.join(output,'design-settings-team-desktop.png'),fullPage:true});
  await settings.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();await settings.waitFor({state:'hidden'});await composer.waitFor();
  checks.push('The account workspace action opens team settings with actual members and roles without inviting or changing budgets');
  for(const legacy of ['/?view=billing','/pricing']){
    await page.goto(origin+legacy);await settings.waitFor();await settings.getByRole('heading',{name:'Facturation',exact:true}).waitFor();
    assert.equal(await billingNavigation.getByRole('button',{name:'Paiements',exact:true}).getAttribute('aria-current'),'page');
    assert.equal(await page.locator('.view-content .billing-page').count(),0);assert.equal(checkoutCalls,0);
    await settings.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();await settings.waitFor({state:'hidden'});await composer.waitFor();
  }
  const beforeReturn={quotes:quoteRequests.length,checkout:checkoutCalls,authorizations:authorizationRequests.length,revocations:revocationRequests.length};
  await page.goto(origin+'/?billingOrder=fixture-return-order');await settings.waitFor();await settings.getByText('Paiement enregistré : Paiement attendu.',{exact:true}).waitFor();
  assert.ok(orderVerificationRequests.some(request=>request.id==='fixture-return-order'&&request.verify==='true'));
  assert.deepEqual({quotes:quoteRequests.length,checkout:checkoutCalls,authorizations:authorizationRequests.length,revocations:revocationRequests.length},beforeReturn);
  checks.push('Billing lives inside settings; legacy URLs and payment returns open the dialog and only verify the existing order');
  checks.push('Embedded billing preserves quote and launch guards; no checkout or payment is triggered by navigation');
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  for(const legacy of ['/?view=billing','/pricing']){
    await page.goto(origin+legacy);await settings.waitFor();await settings.getByRole('heading',{name:'Facturation',exact:true}).waitFor();
    const activeBillingTab=settings.locator('.settings-navigation').getByRole('button',{name:'Facturation',exact:true});
    await page.waitForFunction(()=>document.activeElement?.matches('.settings-navigation button[aria-pressed="true"]')&&document.activeElement.textContent.trim()==='Facturation');
    assert.equal(await activeBillingTab.evaluate(element=>element===document.activeElement),true);
    const tabBounds=await activeBillingTab.boundingBox(),navBounds=await settings.locator('.settings-navigation').boundingBox();
    assert.ok(tabBounds.x>=navBounds.x&&tabBounds.x+tabBounds.width<=navBounds.x+navBounds.width,'The active billing tab must remain fully visible in the mobile navigation scrollport');
    assert.ok(tabBounds.y>=navBounds.y&&tabBounds.y+tabBounds.height<=navBounds.y+navBounds.height);
  }
  checks.push('Mobile billing deep links focus the active section and reveal it within the navigation scrollport');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const mobileRefresh=await settings.getByRole('button',{name:'Actualiser la facturation',exact:true}).boundingBox();assert.ok(mobileRefresh.x+mobileRefresh.width<=390);
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await billingNavigation.getByRole('button',{name:'Forfait',exact:true}).click();
  for(const name of ['Essentiel','Pro','Business'])assert.equal(await embeddedBilling.getByRole('heading',{name,exact:true}).count(),1);
  const mobilePlans=await planLayout();
  assert.equal(mobilePlans.cards.filter(card=>card.visible>=card.width-1).length,1,'Mobile shows one complete plan card');
  assert.ok(mobilePlans.cards[1].visible>0&&mobilePlans.cards[1].visible<mobilePlans.cards[1].width);
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await capture({path:path.join(output,'design-billing-mobile.png'),fullPage:true});
  await planCarousel.focus();await planCarousel.press('End');await waitForLastPlan();
  await page.waitForFunction(()=>document.querySelector('button[aria-label="Forfaits suivants"]').disabled);
  assert.equal(await nextPlans.isDisabled(),true);
  await capture({path:path.join(output,'billing-offers-mobile-last.png'),fullPage:true});
  await planCarousel.press('Home');await page.waitForFunction(()=>document.querySelector('[aria-label="Forfaits disponibles"]').scrollLeft<1);
  assert.equal(checkoutCalls,0);
  checks.push('Mobile plan comparison stays inside settings, reveals every offer and respects reduced motion');
  billingEnabled=true;await settings.getByRole('button',{name:'Actualiser la facturation',exact:true}).click();await billingNavigation.getByRole('button',{name:'Recharger',exact:true}).click();
  await embeddedBilling.getByRole('button',{name:/125 crédits/}).click();await embeddedBilling.getByRole('button',{name:'Vérifier le récapitulatif',exact:true}).click();await assertQuoteTax(5000);
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await capture({path:path.join(output,'billing-tax-review-mobile.png'),fullPage:true});billingEnabled=false;
  checks.push('Mobile pricing and tax review remain contained, with server totals and checkout disabled for ineligible quotes');
  await page.goto(origin);await composer.waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await capture({path:path.join(output,'design-home-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Ouvrir la navigation',exact:true}).click();await page.locator('.sidebar.mobile-open').waitFor();
  await page.locator('.account-trigger').click();await assertAccountMenuVisible();await capture({path:path.join(output,'design-account-menu-mobile.png'),fullPage:true});await page.locator('.account-trigger').click();
  checks.push('Account menu remains fully visible with expanded, collapsed and mobile navigation');
  await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:'Paramètres',exact:true}).click();await settings.waitFor();
  await settings.locator('.settings-navigation').getByRole('button',{name:'Connecteurs',exact:true}).click();await settings.getByRole('button',{name:'Activer Meta Ads',exact:true}).waitFor();
  assert.equal(await settings.locator('.settings-navigation').evaluate(element=>getComputedStyle(element).flexDirection),'row');
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await capture({path:path.join(output,'design-settings-mobile.png'),fullPage:true});
  await settings.locator('.settings-navigation').getByRole('button',{name:'Général',exact:true}).click();await settings.getByText('fixture@example.test',{exact:true}).waitFor();
  assert.ok(await settings.evaluate(element=>element.scrollWidth<=element.clientWidth));
  await capture({path:path.join(output,'design-settings-general-mobile.png'),fullPage:true});
  await settings.locator('.settings-navigation').getByRole('button',{name:'Connecteurs',exact:true}).click();await settings.getByRole('button',{name:'Activer Meta Ads',exact:true}).waitFor();
  await settings.getByRole('button',{name:'Activer Meta Ads',exact:true}).click();await metaDetail.waitFor();
  assert.ok(await metaDetail.evaluate(element=>element.scrollWidth<=element.clientWidth));
  const detailBounds=await metaDetail.boundingBox();assert.ok(detailBounds.x>=0&&detailBounds.x+detailBounds.width<=390);
  await capture({path:path.join(output,'design-connector-detail-mobile.png'),fullPage:true});
  await page.keyboard.press('Escape');await metaDetail.waitFor({state:'hidden'});assert.equal(await settings.isVisible(),true);
  await page.keyboard.press('Escape');await settings.waitFor({state:'hidden'});
  await page.setViewportSize({width:1280,height:800});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(origin);await composer.fill('Bonjour');
  checks.push('Design system: shared tokens, desktop/mobile settings, catalog, billing and 72px rail');
  checks.push('Composer grows only vertically, caps at 192px and scrolls internally');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=analyzing]').waitFor();
  await page.locator('[data-slot=ai-status][data-state=writing]').waitFor();
  assert.equal(await page.locator('.message.assistant .aira-avatar[data-state="working"]').count(),1);
  await page.locator('.message.assistant canvas[data-bot-avatar="clover"][data-state="working"]').waitFor();
  await capture({path:path.join(output,'desktop-writing.png'),fullPage:true});
  assert.equal(await page.locator('[data-slot=ai-status][data-state=done]').count(),0);
  assert.equal(await page.locator('[data-slot=streaming-response][data-state=streaming]').getByRole('button').count(),0);
  const summaryReadsBeforeRun=summaryReads;
  const settledWalletSummary=page.waitForResponse(async response=>new URL(response.url()).pathname==='/api/billing/summary'&&response.request().method()==='GET'&&(await response.json()).wallet.available===195);
  await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:'Paramètres',exact:true}).click();await settings.waitFor();
  await settings.getByText('200 crédits',{exact:true}).waitFor();
  await settings.getByText('195 crédits',{exact:true}).waitFor();
  await settledWalletSummary;
  assert.ok(summaryReads>=summaryReadsBeforeRun+2,'An open wallet must re-read its summary after the chat run settles');
  assert.equal(await settings.getByText('200 crédits',{exact:true}).count(),0,'The old wallet amount must not survive settlement');
  await settings.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();await settings.waitFor({state:'hidden'});
  checks.push('An open settings wallet refreshes its real balance when a conversation run settles');
  await page.locator('[data-slot=ai-status][data-state=done]').waitFor();
  await page.locator('.message.assistant canvas[data-bot-avatar="clover"][data-state="default"]').first().waitFor();
  assert.equal(await page.locator('.aira-avatar[data-state="working"]').count(),0);
  checks.push('Clover avatar works during the current response and returns to its resting state after completion');
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
  await page.getByRole('button',{name:'Rechercher',exact:true}).click();await page.getByRole('textbox',{name:'Rechercher dans votre espace'}).fill(proposal.title);await page.locator('.search-results button').filter({hasText:proposal.title}).click();
  const sidePanel=page.getByRole('complementary',{name:'Espace de travail',exact:true});await sidePanel.getByRole('heading',{name:proposal.title,exact:true}).waitFor();
  await composer.fill('Brouillon avec ressource ouverte');const messageCountBeforeSettings=await page.locator('.messages article').count(),scrollBeforeSettings=await page.locator('.messages').evaluate(element=>element.scrollTop);
  await page.locator('.account-trigger').click();await page.getByRole('menuitem',{name:/Crédits et facturation/}).click();await settings.waitFor();await settings.getByRole('heading',{name:'Facturation',exact:true}).waitFor();
  await settings.getByRole('button',{name:'Fermer les paramètres',exact:true}).click();await settings.waitFor({state:'hidden'});
  assert.equal(await composer.inputValue(),'Brouillon avec ressource ouverte');assert.equal(await page.locator('.messages article').count(),messageCountBeforeSettings);assert.equal(await page.locator('.messages').evaluate(element=>element.scrollTop),scrollBeforeSettings);
  await sidePanel.getByRole('heading',{name:proposal.title,exact:true}).waitFor();assert.equal(approvals,0);assert.equal(checkoutCalls,0);
  checks.push('Billing settings preserve the current messages, composer draft, conversation scroll and open resource panel');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Coupure réseau');await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=error]').waitFor();
  assert.ok((await page.locator('.messages').innerText()).includes('Résultat de test conservé.'));checks.push('Interrupted stream keeps received text and never claims success');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Arrêt utilisateur');await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=writing]').waitFor();
  await page.getByRole('button',{name:'Arrêter la réponse',exact:true}).click();
  await page.locator('[data-slot=ai-status][data-state=cancelled]').waitFor();assert.equal(stops,1);checks.push('Stop remains distinct from failure and cancels the existing run');
  assert.equal(await page.locator('.aira-avatar[data-state="working"]').count(),0);
  await page.getByRole('button',{name:'Rechercher',exact:true}).click();
  await page.getByRole('textbox',{name:'Rechercher dans votre espace'}).fill(proposal.title);
  await page.locator('.search-results button').filter({hasText:proposal.title}).click();
  await page.getByRole('button',{name:'Approuver et générer'}).evaluate(button=>{button.click();button.click();});
  await page.locator('[data-slot=grid-reveal][data-state=pending]').waitFor();
  await capture({path:path.join(output,'desktop-grid-pending.png'),fullPage:true});
  await page.locator('[data-slot=grid-reveal][data-state=error]').waitFor({timeout:12000});assert.equal(approvals,1);
  await page.getByRole('button',{name:'Réessayer',exact:true}).click();
  await page.locator('[data-slot=grid-reveal][data-state=ready]').waitFor({timeout:12000}).catch(async()=>{
    // The settled grid is intentionally replaced by the native result image.
    await page.locator('.media-output img').waitFor({state:'visible'});
  });
  await page.locator('.media-output img').waitFor({state:'visible'});assert.equal(approvals,1);assert.ok(polls>=2);
  checks.push('One approved generation: pending grid, read-only follow-up, actual image reveal');
  assert.ok(imageRequests>=2);assert.equal(approvals,1);checks.push('Failed image load retries only the image, never the paid generation');
  await capture({path:path.join(output,'desktop.png'),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  await page.getByRole('complementary',{name:'Espace de travail'}).getByRole('button',{name:'Fermer l’espace de travail',exact:true}).click();
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Mobile');await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-active]').waitFor();
  await page.waitForFunction(()=>{const path=document.querySelector('[data-slot=ai-status][data-active] .ai-status-icon svg path');return path&&getComputedStyle(path).animationName==='none';});
  await page.locator('[data-slot=ai-status][data-state=done]').waitFor();
  assert.equal(await page.locator('.response-footer').last().evaluate(element=>getComputedStyle(element).animationName),'none');
  assert.ok(await page.locator('.response-action').last().evaluate(element=>element.getBoundingClientRect().height>=44));
  await capture({path:path.join(output,'mobile-reduced-motion.png'),fullPage:true});checks.push('Mobile: no horizontal overflow; reduced-motion animation disabled');
  assert.equal(checkoutCalls,0);assert.equal(organizationMutations.length,0);
  assert.deepEqual(pageErrors,[]);checks.push('No unhandled browser errors');
  await writeFile(path.join(output,'results.json'),JSON.stringify({checks,chatCalls,approvals,polls,connectorAuthorizationCalls:authorizationRequests.length,connectorRevocationCalls:revocationRequests.length,billingQuoteCalls:quoteRequests.length,billingCheckoutCalls:checkoutCalls,organizationMutationCalls:organizationMutations.length,externalProviderCalls:0},null,2));
  for(const check of checks)console.log('PASS '+check);
}catch(error){if(lastPage){await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error((await lastPage.locator('body').innerText()).slice(0,1200));}throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
