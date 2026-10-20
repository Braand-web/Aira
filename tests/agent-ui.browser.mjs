// Real React/Chromium UI with a local fixture server. No credentials or external provider calls.
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
const output=path.join(root,'.tmp','agent-ui-browser');
await mkdir(output,{recursive:true});
await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import Studio from "./app/studio";import {FilePreviewProvider} from "./components/file-preview/file-preview-provider";import "./app/globals.css";import "./app/file-upload.css";import "./components/file-preview/file-preview.css";createRoot(document.getElementById("root")).render(<FilePreviewProvider><Studio/></FilePreviewProvider>);',resolveDir:root,loader:'tsx'},outdir:output,entryNames:'app',chunkNames:'chunks/[name]-[hash]',alias:{'next/image':'vinext/shims/image'},bundle:true,splitting:true,format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'fixture-worker-url',setup(builder){builder.onResolve({filter:/^pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url$/},()=>({path:'worker',namespace:'fixture'}));builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default "/unused-pdf-worker.mjs";',loader:'js'}));}}]});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1ZsAAAAASUVORK5CYII=','base64');
const now=Date.now();
const proposal={id:'proposal-fixture',workspace_id:'fixture',kind:'proposal',title:'Visuel de test local',status:'awaiting_approval',version:1,created_at:now,updated_at:now,data:{kind:'media',rationale:'Fixture locale sans génération facturable',maxCredits:5,payload:{model:'fixture-image',input:{prompt:'Fixture'}}}};
const media={id:'media-fixture',workspace_id:'fixture',kind:'media',title:proposal.title,status:'ready',version:1,created_at:now,updated_at:now,data:{model:'fixture-image',output:{images:[]}}};
let approvals=0,polls=0,chatCalls=0,stops=0,imageRequests=0;
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.test');
  if(url.pathname==='/api/workspace'){json(res,{user:{id:'fixture-user',name:'Compte de test',email:'fixture@example.test'},workspace:{name:'Espace de test',credits:200,reserved:0},resources:[proposal],catalog:[{id:'fixture-image',kind:'image'}],capabilities:{model:true,modelReady:true,filePreview:false}});return;}
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
    else if(body.text!=='Arrêt utilisateur')timers.push(setTimeout(()=>{emit('done',{runId:'run-'+chatCalls});res.end();},1700));
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
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Aïra · Test isolé</title></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
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
  await page.goto(origin);await page.getByRole('textbox',{name:'Votre demande à Aïra'}).fill('Bonjour');
  await page.getByRole('textbox',{name:'Votre demande à Aïra'}).press('Enter');
  await page.locator('[data-slot=ai-status][data-state=analyzing]').waitFor();
  await page.locator('[data-slot=ai-status][data-state=writing]').waitFor();
  await page.screenshot({path:path.join(output,'desktop-writing.png'),fullPage:true});
  assert.equal(await page.locator('[data-slot=ai-status][data-state=done]').count(),0);
  await page.locator('[data-slot=ai-status][data-state=done]').waitFor();
  assert.equal(chatCalls,1);checks.push('Chat: real stream states, one request, completion only after done');
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
  assert.equal(await page.locator('.ai-status-icon svg path').first().evaluate(element=>getComputedStyle(element).animationName),'none');
  await page.locator('[data-slot=ai-status][data-state=done]').waitFor();
  await page.screenshot({path:path.join(output,'mobile-reduced-motion.png'),fullPage:true});checks.push('Mobile: no horizontal overflow; reduced-motion animation disabled');
  assert.deepEqual(pageErrors,[]);checks.push('No unhandled browser errors');
  await writeFile(path.join(output,'results.json'),JSON.stringify({checks,chatCalls,approvals,polls,externalProviderCalls:0},null,2));
  for(const check of checks)console.log('PASS '+check);
}catch(error){if(lastPage){await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error((await lastPage.locator('body').innerText()).slice(0,1200));}throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
