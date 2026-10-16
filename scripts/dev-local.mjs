// Local-only development adapter. Never used by the hosted Worker.
import {createServer} from "node:http";
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {AsyncLocalStorage} from "node:async_hooks";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {randomBytes} from "node:crypto";
import path from "node:path";
const project=path.resolve(import.meta.dirname,"..");
const runtime=process.env.AIRA_TOOLCHAIN||path.join(project,"node_modules");
const require=createRequire(path.join(runtime,"package.json"));
const {build}=require("esbuild");
const output=path.join(project,".local-build"),dataDir=process.env.AIRA_DATA_DIR?path.resolve(process.env.AIRA_DATA_DIR):path.join(project,".local-data");
mkdirSync(output,{recursive:true});mkdirSync(dataDir,{recursive:true});mkdirSync(path.join(dataDir,"files"),{recursive:true});
const sql=new DatabaseSync(path.join(dataDir,"aira.sqlite"));
sql.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY)");
for(const file of readdirSync(path.join(project,"drizzle")).filter(f=>f.endsWith(".sql")).sort()){
 if(!sql.prepare("SELECT name FROM _local_migrations WHERE name=?").get(file)){
  sql.exec("BEGIN");try{sql.exec(readFileSync(path.join(project,"drizzle",file),"utf8"));sql.prepare("INSERT INTO _local_migrations VALUES (?)").run(file);sql.exec("COMMIT");}catch(error){sql.exec("ROLLBACK");throw error;}
 }
}
function statement(query,args=[]){const bound=()=>sql.prepare(query);return {
 bind(...values){return statement(query,values);},
 async first(column){const row=bound().get(...args);return column?row?.[column]??null:row??null;},
 async all(){return {results:bound().all(...args),success:true};},
 async run(){return this._run();},
 _run(){const r=bound().run(...args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}
};}
const DB={prepare:query=>statement(query),async batch(statements){sql.exec("BEGIN");try{const results=statements.map(s=>s._run());sql.exec("COMMIT");return results;}catch(error){sql.exec("ROLLBACK");throw error;}}};
const filePath=key=>{const file=path.resolve(dataDir,"files",key);if(!file.startsWith(path.resolve(dataDir,"files")+path.sep))throw new Error("Invalid storage key");return file;};
const BUCKET={
 async put(key,bytes,options){const file=filePath(key);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,Buffer.from(bytes));writeFileSync(file+".meta",JSON.stringify(options?.httpMetadata||{}));},
 async get(key){const file=filePath(key);if(!existsSync(file))return null;const bytes=readFileSync(file);return {size:bytes.length,body:new Blob([bytes]).stream(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};},
 async delete(key){const {unlinkSync}=await import("node:fs");for(const file of [filePath(key),filePath(key)+".meta"])if(existsSync(file))unlinkSync(file);}
};
const settings={};
const allowed=new Set(["ANTHROPIC_API_KEY","ANTHROPIC_MODEL","FAL_KEY","FAL_CATALOG_JSON","META_APP_ID","META_APP_SECRET","META_GRAPH_VERSION","META_REDIRECT_URI","TOKEN_ENCRYPTION_KEY"]);
const configFile=path.join(project,".dev.vars");
if(existsSync(configFile))for(const line of readFileSync(configFile,"utf8").split(/\r?\n/)){const match=line.match(/^([A-Z_]+)=(.*)$/);if(match&&allowed.has(match[1]))settings[match[1]]=match[2].trim().replace(/^["']|["']$/g,"");}
const context=new AsyncLocalStorage();globalThis.__airaLocal={env:{DB,BUCKET,...settings},context};
const routeFiles={
 workspace:"app/api/workspace/route.ts",chat:"app/api/chat/route.ts",files:"app/api/files/route.ts",
 resource:"app/api/resources/[id]/route.ts",page:"app/api/pages/[id]/route.ts",proposal:"app/api/proposals/[id]/route.ts",
 meta:"app/api/meta/route.ts",connect:"app/api/meta/connect/route.ts",callback:"app/api/meta/callback/route.ts"
};
const entry=Object.entries(routeFiles).map(([name,file])=>'export * as '+name+' from "'+path.join(project,file).replaceAll("\\","/")+'";').join("\n");
await build({stdin:{contents:entry,resolveDir:project,loader:"ts"},outfile:path.join(output,"routes.mjs"),bundle:true,platform:"node",format:"esm",nodePaths:[runtime],plugins:[{name:"local-environment",setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"env",namespace:"local"}));
 b.onResolve({filter:/^next\/headers$/},()=>({path:"headers",namespace:"local"}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:"navigation",namespace:"local"}));
 b.onLoad({filter:/.*/,namespace:"local"},args=>({contents:args.path==="env"?"export const env=globalThis.__airaLocal.env;":args.path==="headers"?"export async function headers(){return globalThis.__airaLocal.context.getStore()?.headers||new Headers();}":"export function redirect(url){throw new Error('Unexpected server redirect: '+url);}"}));
}}]});
const routes=await import(pathToFileURL(path.join(output,"routes.mjs")).href);
await build({stdin:{contents:'import React from "react";import {createRoot} from "react-dom/client";import Studio from "'+path.join(project,"app/studio.tsx").replaceAll("\\","/")+'";createRoot(document.getElementById("root")).render(<Studio/>);',resolveDir:project,loader:"tsx"},outfile:path.join(output,"app.js"),bundle:true,format:"esm",jsx:"automatic",nodePaths:[runtime],define:{"process.env.NODE_ENV":'"development"'}});
const session=randomBytes(32).toString("hex");
const port=Number(process.env.PORT||4175);
const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aïra · Développement local</title><link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.svg"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
function sendJSON(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{
 try{
  const origin="http://127.0.0.1:"+port;
  if(req.headers.host!=="127.0.0.1:"+port&&req.headers.host!=="localhost:"+port){sendJSON(res,403,{error:"Local host only."});return;}
  const url=new URL(req.url,origin);
  if(url.pathname==="/signin-with-chatgpt"){res.writeHead(302,{"Set-Cookie":"aira_local_session="+session+"; HttpOnly; SameSite=Strict; Path=/",Location:"/"});res.end();return;}
  if(url.pathname==="/signout-with-chatgpt"){res.writeHead(302,{"Set-Cookie":"aira_local_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",Location:"/"});res.end();return;}
  if(url.pathname.startsWith("/api/")){
   const signedIn=(req.headers.cookie||"").split(";").some(c=>c.trim()==="aira_local_session="+session);
   const headers=new Headers();if(signedIn){headers.set("oai-authenticated-user-id","aira_local_preview");headers.set("oai-authenticated-user-email","local@aira.test");headers.set("oai-authenticated-user-full-name","Espace%20local");headers.set("oai-authenticated-user-full-name-encoding","percent-encoded-utf-8");}
   const requestHeaders=new Headers();for(const [k,v] of Object.entries(req.headers))if(v&&!k.startsWith("oai-authenticated-user-"))requestHeaders.set(k,Array.isArray(v)?v.join(","):v);
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>24*1024*1024){sendJSON(res,413,{error:"Requête trop volumineuse."});return;}chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:requestHeaders,...(!["GET","HEAD"].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const exact={"/api/workspace":"workspace","/api/chat":"chat","/api/files":"files","/api/meta":"meta","/api/meta/connect":"connect","/api/meta/callback":"callback"};
   let name=exact[url.pathname],id;const match=url.pathname.match(/^\/api\/(resources|pages|proposals)\/([^/]+)$/);
   if(match){name={resources:"resource",pages:"page",proposals:"proposal"}[match[1]];id=decodeURIComponent(match[2]);}
   const handler=name&&routes[name]?.[req.method];if(!handler){sendJSON(res,404,{error:"Route introuvable."});return;}
   let response=await context.run({headers},()=>handler(request,{params:Promise.resolve({id})}));
   if(url.pathname==="/api/workspace"&&req.method==="GET"&&response.ok){const body=await response.json();response=Response.json({...body,development:true});}
   res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body){const reader=response.body.getReader();res.on("close",()=>{if(!res.writableFinished)void reader.cancel();});while(true){const {done,value}=await reader.read();if(done)break;if(!res.destroyed)res.write(Buffer.from(value));}}res.end();return;
  }
  const staticFiles={"/app.js":[path.join(output,"app.js"),"application/javascript"],"/style.css":[path.join(project,"app/globals.css"),"text/css"],"/favicon.svg":[path.join(project,"public/favicon.svg"),"image/svg+xml"]};
  if(staticFiles[url.pathname]){const [file,type]=staticFiles[url.pathname];res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"});res.end(readFileSync(file));return;}
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);
 }catch(error){console.error("Local request:",error instanceof Error?error.message:"error");if(!res.headersSent)sendJSON(res,500,{error:"Erreur du serveur local."});else res.end();}
});
server.listen(port,"127.0.0.1",()=>console.log("Aïra local (SQLite + actual API routes): http://127.0.0.1:"+port+"\nLocal development sign-in only. No provider credentials are included."));

