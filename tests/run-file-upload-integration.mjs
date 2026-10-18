import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const tempParent=path.resolve(os.tmpdir()),tempRoot=await mkdtemp(path.join(tempParent,"aira-file-upload-"));
assert.ok(tempRoot.startsWith(tempParent+path.sep),"Test data directory must stay under the system temporary directory.");
const signingSecret="local-file-upload-test-signing-secret-00000000000000000000000000000000";
const schedulerSecret="local-file-upload-test-scheduler-secret";
const configFile=path.join(tempRoot,"dev.vars"),dataDir=path.join(tempRoot,"data"),buildDir=path.join(tempRoot,"build");
await writeFile(configFile,["FILE_PREVIEW_V1=true",`FILE_URL_SIGNING_SECRET=${signingSecret}`,`SCHEDULER_SECRET=${schedulerSecret}`,""].join("\n"),"utf8");

async function freePort(){
 const server=net.createServer();await new Promise((resolve,reject)=>server.once("error",reject).listen(0,"127.0.0.1",resolve));
 const {port}=server.address();await new Promise(resolve=>server.close(resolve));return port;
}
function cleanEnvironment(){
 const result={...process.env};
 for(const key of Object.keys(result))if(/^(?:COMPOSIO_|SASPAY_|BILLING_|OPENROUTER_|ANTHROPIC_|FAL_|META_|TOKEN_ENCRYPTION_KEY$|FILE_URL_SIGNING_SECRET$|SCHEDULER_SECRET$)/u.test(key))delete result[key];
 return result;
}
function capture(child){
 let output="";for(const stream of [child.stdout,child.stderr])stream?.on("data",chunk=>{output=(output+chunk.toString()).slice(-12_000);});return()=>output;
}
function run(child){return new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",(code,signal)=>resolve({code,signal}));});}

let server;
try{
 const port=await freePort(),env={...cleanEnvironment(),PORT:String(port),AIRA_CONFIG_FILE:configFile,AIRA_DATA_DIR:dataDir,AIRA_BUILD_DIR:buildDir};
 server=spawn(process.execPath,["scripts/dev-local.mjs"],{cwd:project,env,stdio:["ignore","pipe","pipe"]});
 const serverOutput=capture(server);let ready=false;const deadline=Date.now()+60_000;
 while(Date.now()<deadline){
  if(server.exitCode!==null)throw new Error(`Local test server exited early. ${serverOutput()}`);
  try{const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(1_000)});if(response.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,`Local test server did not become ready. ${serverOutput()}`);
 const integration=spawn(process.execPath,["tests/file-preview.integration.mjs"],{cwd:project,env:{...env,AIRA_TEST_URL:`http://127.0.0.1:${port}`,AIRA_TEST_SQLITE_PATH:dataDir,AIRA_TEST_SCHEDULER_SECRET:schedulerSecret},stdio:["ignore","pipe","pipe"]});
 const testOutput=capture(integration),result=await run(integration);
 process.stdout.write(testOutput());
 assert.equal(result.code,0,`HTTP integration test failed. ${testOutput()}`);
}finally{
 if(server&&server.exitCode===null){server.kill();await Promise.race([run(server),new Promise(resolve=>setTimeout(resolve,3_000))]);}
 const resolved=path.resolve(tempRoot);
 if(resolved.startsWith(tempParent+path.sep)&&path.basename(resolved).startsWith("aira-file-upload-"))await rm(resolved,{recursive:true,force:true});
}
