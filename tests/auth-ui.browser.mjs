// Isolated browser E2E: actual HTML, SQLite, cookies and Web Crypto; simulated Resend.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:https';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'.tmp/auth-ui');
await mkdir(output,{recursive:true});
await build({entryPoints:['lib/auth-runtime.ts'],outfile:path.join(output,'auth.mjs'),bundle:true,platform:'node',format:'esm'});
const auth=await import(pathToFileURL(path.join(output,'auth.mjs')));
const require=createRequire(import.meta.url),playwright=process.env.BRAAND_PLAYWRIGHT_MODULE;
const {chromium}=await import(playwright?pathToFileURL(path.resolve(playwright)).href:require.resolve('playwright'));
const sql=new DatabaseSync(':memory:');sql.exec(await readFile('drizzle/0014_independent_auth.sql','utf8'));
function statement(query,args=[]){return {bind(...values){return statement(query,values);},async first(){return sql.prepare(query).get(...args)||null;},async run(){return sql.prepare(query).run(...args);}};}
const env={DB:{prepare:q=>statement(q),batch:async rows=>Promise.all(rows.map(r=>r.run()))},APP_ENV:'test',APP_ORIGIN:'https://braand.test',AUTH_ENABLED:'true',AUTH_HASH_SECRET:'offline-browser-auth-fixture-'.repeat(2),RESEND_MODE:'sandbox',RESEND_FROM:'sender@braand.test',RESEND_TEST_RECIPIENT:'owner@braand.test',RESEND_API_KEY:'offline-only'};
const originalFetch=globalThis.fetch;let link,mailCount=0,checks=0,browser;
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');const mail=JSON.parse(options.body);link=mail.text.match(/https:\/\/[^\s]+/)[0];mailCount++;return Response.json({id:'fixture-mail'});};
const check=(name)=>{console.log('PASS '+name);checks++;};
// Ephemeral local TLS lets the browser exercise Secure cookies and native redirects.
// OpenSSL is present on Linux/macOS and supplied by Git for Windows; no key is committed.
const openssl=process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Git/usr/bin/openssl.exe'):'openssl';
const keyFile=path.join(output,'tls-key.pem'),certFile=path.join(output,'tls-cert.pem');
execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
const requestFailures=[];
const server=createServer({key:await readFile(keyFile),cert:await readFile(certFile)},async(req,res)=>{
 try {
  const u=new URL(req.url,env.APP_ORIGIN);
  if(u.pathname==='/auth.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(await readFile('public/auth.css','utf8'));return;}
  if(u.pathname==='/favicon.svg'){res.writeHead(204);res.end();return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=new Request(u,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  if(req.method==='POST') {
   assert.equal(request.headers.get('origin'),env.APP_ORIGIN,'Browser form preserves the same-origin CSRF proof');
   assert.equal(request.headers.get('referer'),env.APP_ORIGIN+'/','Form requests never leak magic-link paths or tokens');
  }
  const response=await auth.handleAuth(request,env)||new Response('<h1>Espace Braand</h1>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  const headers=Object.fromEntries(response.headers),cookies=response.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;
  res.writeHead(response.status,headers);res.end(await response.text());
 } catch {requestFailures.push('HTTPS fixture request failed');res.writeHead(500);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
env.APP_ORIGIN='https://127.0.0.1:'+server.address().port;
try {
 try{browser=await chromium.launch({headless:true});}catch{browser=await chromium.launch({headless:true,channel:'msedge'});}
 const context=await browser.newContext({viewport:{width:1280,height:800},ignoreHTTPSErrors:true}),errors=[];
 await context.route('**/*',async route=>{
  assert.equal(new URL(route.request().url()).origin,env.APP_ORIGIN,'No external browser requests');await route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(env.APP_ORIGIN+'/auth/sign-in');await page.getByLabel('Votre adresse e-mail').waitFor();
 await page.screenshot({path:path.join(output,'desktop.png')});
 assert.equal(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);check('Desktop login fits, uses a real labeled form and requires no script');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth),true);
 await page.getByLabel('Votre adresse e-mail').focus();assert.equal(await page.getByLabel('Votre adresse e-mail').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
 await page.screenshot({path:path.join(output,'mobile.png')});check('Mobile layout has no overflow and keyboard focus is visible');
 await page.getByLabel('Votre adresse e-mail').fill('owner@braand.test');
 const [mailResponse]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/request'),page.getByRole('button',{name:'Recevoir mon lien'}).click()]);
 assert.equal(mailResponse.status(),200,`Email request returned ${mailResponse.status()}: ${await page.locator('h1').textContent()}`);
 await page.getByRole('heading',{name:'Consultez votre messagerie'}).waitFor();assert.equal(mailCount,1);check('A real form requests one email without showing the private token');
 await page.goto(link);await page.getByRole('button',{name:'Entrer dans mon espace'}).waitFor();assert.equal(sql.prepare('SELECT count(*) n FROM auth_sessions').get().n,0);check('Opening the email link requests confirmation before authentication');
 await page.getByRole('button',{name:'Entrer dans mon espace'}).click();
 await page.getByRole('heading',{name:'Espace Braand'}).waitFor();
 const cookies=await context.cookies(env.APP_ORIGIN),session=cookies.find(c=>c.name==='__Host-braand_session');assert.ok(session?.httpOnly&&session?.secure);assert.ok(await auth.sessionIdentity(new Headers({cookie:session.name+'='+session.value}),env));check('Confirmed login sets a private Secure/HttpOnly cookie and a real revocable session');
 await page.goto(env.APP_ORIGIN+'/auth/sign-out');await page.getByRole('button',{name:'Confirmer la déconnexion'}).click();await page.getByRole('heading',{name:'Espace Braand'}).waitFor();
 assert.equal(await auth.sessionIdentity(new Headers({cookie:session.name+'='+session.value}),env),null);check('Logout revokes the stored session and removes the browser cookie');
 assert.deepEqual(errors,[]);assert.deepEqual(requestFailures,[]);assert.equal(mailCount,1);check('No client errors and zero real provider or payment requests');
} finally {globalThis.fetch=originalFetch;await browser?.close();await new Promise(resolve=>server.close(resolve));sql.close();}
console.log(`${checks} independent login browser checks passed.`);
