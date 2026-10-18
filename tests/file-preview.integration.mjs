import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import path from "node:path";
import {FILE_POLICY,OFFICE_MIME_TYPES} from "../lib/file-policy.mjs";
import {createDocxPreviewFixture} from "./office-preview-fixtures.mjs";

const base=process.env.AIRA_TEST_URL||"http://127.0.0.1:4199";
if(!/^http:\/\/127\.0\.0\.1:\d+$/u.test(base))throw new Error("File-preview integration tests only run against local development.");
let cookie="";
async function request(path,method="GET",body,extra={}){
 const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body instanceof FormData?{}:body===undefined?{}:{"Content-Type":"application/json"}),...extra},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),redirect:"manual"});
 return {response,status:response.status,data:response.headers.get("content-type")?.includes("json")?await response.json():await response.text()};
}
async function rawRequest(path,method,body,extra={}){
 const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),"Content-Type":"application/octet-stream",...extra},body,redirect:"manual"});
 return {response,status:response.status,data:response.headers.get("content-type")?.includes("json")?await response.json():await response.text()};
}
async function binaryRequest(path){const response=await fetch(base+path,{headers:{...(cookie?{Cookie:cookie}:{})},redirect:"manual"});return {response,status:response.status,data:new Uint8Array(await response.arrayBuffer())};}
let r=await request("/signin-with-chatgpt");assert.equal(r.status,302);cookie=r.response.headers.get("set-cookie").split(";")[0];
const privateText=`texte privé · ${crypto.randomUUID()}`;
const upload=new FormData();upload.set("file",new File([privateText],"référence-équipe.txt",{type:"text/plain"}));
r=await request("/api/files","POST",upload);assert.equal(r.status,201);const fileId=r.data.id;
assert.equal(r.data.data.key,undefined);assert.equal(r.data.data.text,undefined);
r=await request("/api/workspace");const listed=r.data.resources.find(item=>item.id===fileId);assert.equal(listed.data.mime,"text/plain");assert.equal(listed.data.size,new TextEncoder().encode(privateText).byteLength);assert.equal(listed.data.key,undefined);
r=await request(`/api/resources/${fileId}`);assert.equal(r.data.data.mime,"text/plain");assert.equal(r.data.data.text,undefined);assert.equal(r.data.title,"référence-équipe.txt");
r=await request(`/api/files/${fileId}/metadata`);assert.equal(r.status,200);assert.deepEqual(Object.keys(r.data).sort(),["createdAt","id","mime","name","size","status"].sort());assert.equal(r.data.id,fileId);assert.equal(r.data.name,"référence-équipe.txt");assert.equal(r.data.status,"ready");assert.equal(r.data.size,new TextEncoder().encode(privateText).byteLength);assert.equal(r.response.headers.get("cache-control"),"private, no-store");
r=await request(`/api/files/${fileId}/url`,"POST",{scope:"content"});assert.equal(r.status,200);assert.ok(r.data.expiresAt>Date.now());
const contentURL=new URL(r.data.url,base);assert.equal(contentURL.origin,base);
r=await request(contentURL.pathname+contentURL.search);assert.equal(r.status,200);assert.equal(r.data,privateText);
assert.equal(r.response.headers.get("content-type"),"text/plain");assert.equal(r.response.headers.get("x-content-type-options"),"nosniff");
assert.equal(r.response.headers.get("content-security-policy"),"default-src 'none'; sandbox");assert.match(r.response.headers.get("content-disposition"),/^inline;/u);
const badTokenURL=new URL(contentURL);badTokenURL.searchParams.set("token","invalid.signature");r=await request(badTokenURL.pathname+badTokenURL.search);assert.equal(r.status,404);assert.equal(r.data.code,"file_not_found");
r=await request(contentURL.pathname.replace(fileId,"another-workspace-file")+contentURL.search);assert.equal(r.status,404);assert.equal(r.data.code,"file_not_found");
r=await request(contentURL.pathname+contentURL.search,"GET",undefined,{"x-aira-workspace":"workspace-not-owned"});assert.equal(r.status,404);assert.equal(r.data.code,"file_not_found");
r=await request("/api/files?id="+fileId,"DELETE");assert.equal(r.status,200);assert.equal(r.data.deleted,true);
r=await request(`/api/resources/${fileId}`);assert.equal(r.data.title,"Fichier supprimé");assert.equal(r.data.status,"deleted");
r=await request(contentURL.pathname+contentURL.search);assert.equal(r.status,404);assert.equal(r.data.code,"file_not_found");
let checks=18;
const docxBytes=createDocxPreviewFixture(),officeForm=new FormData();officeForm.set("file",new File([docxBytes],"document-test.docx",{type:OFFICE_MIME_TYPES.docx}));
r=await request("/api/files","POST",officeForm);assert.equal(r.status,201);const docxId=r.data.id;
r=await request(`/api/files/${docxId}/metadata`);assert.equal(r.status,200);assert.equal(r.data.mime,OFFICE_MIME_TYPES.docx);assert.equal(r.data.name,"document-test.docx");
r=await request(`/api/files/${docxId}/url`,"POST",{scope:"content"});assert.equal(r.status,200);const docxURL=new URL(r.data.url,base);
r=await binaryRequest(docxURL.pathname+docxURL.search);assert.equal(r.status,200);assert.equal(r.response.headers.get("content-type"),OFFICE_MIME_TYPES.docx);assert.match(r.response.headers.get("content-disposition"),/^inline;/u);assert.deepEqual(r.data,docxBytes);
r=await request(`/api/files/${docxId}/url`,"POST",{scope:"download"});assert.equal(r.status,200);const docxDownloadURL=new URL(r.data.url,base);r=await request(docxDownloadURL.pathname+docxDownloadURL.search);assert.equal(r.status,200);assert.match(r.response.headers.get("content-disposition"),/^attachment;/u);
r=await request(`/api/files?id=${docxId}`,"DELETE");assert.equal(r.status,200);checks+=6;
const multipartBytes=Buffer.alloc(FILE_POLICY.chunkBytes+37,0x61),wholeHash=createHash("sha256").update(multipartBytes).digest("hex");
r=await request("/api/files/uploads","POST",{name:"trop-grand.txt",size:FILE_POLICY.maxFileBytes+1,mime:"text/plain",sha256:"0".repeat(64)});assert.equal(r.status,400);
r=await request("/api/files/uploads","POST",{name:"reprise-grand-fichier.txt",size:multipartBytes.length,mime:"text/plain",sha256:wholeHash});assert.equal(r.status,201);const uploadId=r.data.upload.uploadId;
r=await request("/api/files/uploads?uploadId="+uploadId);assert.equal(r.status,200);assert.equal(r.data.upload.uploadedParts.length,0);assert.equal(r.data.upload.size,multipartBytes.length);assert.equal(r.data.upload.storage_key,undefined);assert.equal(r.data.upload.multipart_upload_id,undefined);
r=await request("/api/files/uploads?uploadId="+uploadId,"GET",undefined,{"x-aira-workspace":"workspace-not-owned"});assert.equal(r.status,404);assert.equal(r.data.code,"file_not_found");
const partOne=multipartBytes.subarray(0,FILE_POLICY.chunkBytes),partTwo=multipartBytes.subarray(FILE_POLICY.chunkBytes),partOneHash=createHash("sha256").update(partOne).digest("hex"),partTwoHash=createHash("sha256").update(partTwo).digest("hex");
r=await rawRequest(`/api/files/uploads?uploadId=${uploadId}&partNumber=1`,`PUT`,partOne,{"X-Chunk-SHA256":"0".repeat(64)});assert.equal(r.status,400);assert.equal(r.data.code,"upload_checksum_mismatch");
r=await rawRequest(`/api/files/uploads?uploadId=${uploadId}&partNumber=1`,`PUT`,partOne,{"X-Chunk-SHA256":partOneHash});assert.equal(r.status,200);assert.equal(r.data.size,FILE_POLICY.chunkBytes);
r=await request("/api/files/uploads?uploadId="+uploadId);assert.equal(r.data.upload.uploadedParts.length,1);assert.equal(r.data.upload.uploadedParts[0].sha256,partOneHash);
r=await request("/api/files/uploads","POST",{action:"complete",uploadId,sha256:wholeHash});assert.equal(r.status,409);assert.equal(r.data.code,"upload_parts_incomplete");
r=await rawRequest(`/api/files/uploads?uploadId=${uploadId}&partNumber=2`,`PUT`,partTwo.subarray(0,partTwo.length-1),{"X-Chunk-SHA256":createHash("sha256").update(partTwo.subarray(0,partTwo.length-1)).digest("hex")});assert.equal(r.status,400);assert.equal(r.data.code,"upload_checksum_mismatch");
r=await rawRequest(`/api/files/uploads?uploadId=${uploadId}&partNumber=2`,`PUT`,partTwo,{"X-Chunk-SHA256":partTwoHash});assert.equal(r.status,200);
r=await request("/api/files/uploads","POST",{action:"complete",uploadId,sha256:"0".repeat(64)});assert.equal(r.status,409);assert.equal(r.data.code,"upload_file_mismatch");
r=await request("/api/files/uploads","POST",{action:"complete",uploadId,sha256:wholeHash});assert.equal(r.status,201);const multipartFileId=r.data.resource.id;
assert.equal(r.data.resource.status,"ready");assert.equal(r.data.resource.data.size,multipartBytes.length);assert.equal(r.data.resource.data.key,undefined);assert.equal(r.data.resource.data.text,undefined);
r=await request(`/api/files/${multipartFileId}/metadata`);assert.equal(r.status,200);assert.equal(r.data.size,multipartBytes.length);assert.equal(r.data.status,"ready");
const abortBytes=Buffer.from("temporary resumable upload"),abortHash=createHash("sha256").update(abortBytes).digest("hex");
r=await request("/api/files/uploads","POST",{name:"annulation.txt",size:abortBytes.length,mime:"text/plain",sha256:abortHash});assert.equal(r.status,201);const abortUploadId=r.data.upload.uploadId;
r=await request("/api/files/uploads?uploadId="+abortUploadId,"DELETE");assert.equal(r.status,200);assert.equal(r.data.aborted,true);
r=await request("/api/files/uploads?uploadId="+abortUploadId);assert.equal(r.status,404);assert.equal(r.data.code,"upload_not_found");
checks+=36;
if(process.env.AIRA_TEST_SQLITE_PATH&&process.env.AIRA_TEST_SCHEDULER_SECRET){
 const workspace=await request("/api/workspace");assert.equal(workspace.status,200);
 const localDb=new DatabaseSync(path.join(process.env.AIRA_TEST_SQLITE_PATH,"aira.sqlite"));
 const now=Date.now(),conversationId="retention-test-conversation";
 const staleBytes=Buffer.from("incomplete temporary upload"),staleHash=createHash("sha256").update(staleBytes).digest("hex");
 r=await request("/api/files/uploads","POST",{name:"expiration.txt",size:staleBytes.length,mime:"text/plain",sha256:staleHash});assert.equal(r.status,201);const staleUploadId=r.data.upload.uploadId,staleFileId=r.data.upload.fileId;
 localDb.prepare("INSERT INTO resources (id,workspace_id,kind,title,data,status,version,created_at,updated_at) VALUES (?,?,'conversation','Retention test','{}','saved',1,?,?)").run(conversationId,workspace.data.workspace.id,now,now);
 localDb.prepare("INSERT INTO messages (id,workspace_id,conversation_id,role,content,attachments,created_at) VALUES (?,?,?,'user',?,?,?)").run("retention-test-message",workspace.data.workspace.id,conversationId,JSON.stringify([{type:"text",text:"Question gardée"},{type:"text",text:"Extrait privé à purger"}]),JSON.stringify([fileId]),now);
 localDb.prepare("UPDATE files SET deleted_at=? WHERE id=?").run(now-31*24*60*60*1000,fileId);
 localDb.prepare("UPDATE file_upload_sessions SET expires_at=? WHERE id=?").run(now-1,staleUploadId);
 localDb.close();
 r=await request("/api/internal/billing-tick","POST",undefined,{Authorization:`Bearer ${process.env.AIRA_TEST_SCHEDULER_SECRET}`});
 assert.equal(r.status,200);assert.ok(r.data.filesPurged>=1);assert.ok(r.data.uploadsPurged>=1);
 const after=new DatabaseSync(path.join(process.env.AIRA_TEST_SQLITE_PATH,"aira.sqlite"));
 const file=after.prepare("SELECT storage_key FROM files WHERE id=?").get(fileId);assert.equal(file.storage_key,null);
 assert.equal(after.prepare("SELECT id FROM file_upload_sessions WHERE id=?").get(staleUploadId),undefined);assert.equal(after.prepare("SELECT id FROM files WHERE id=?").get(staleFileId),undefined);
 const message=after.prepare("SELECT content,attachments FROM messages WHERE id=?").get("retention-test-message");
 assert.deepEqual(JSON.parse(message.content),[{type:"text",text:"Question gardée"}]);assert.deepEqual(JSON.parse(message.attachments),[]);after.close();
 checks+=11;
}
console.log(`${checks} local signed-file security and retention checks passed.`);
