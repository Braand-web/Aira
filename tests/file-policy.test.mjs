import assert from "node:assert/strict";
import test from "node:test";
import {FILE_POLICY,contentSecurityHeaders,declaredTypeMatches,detectFileType,imageWithinPixelLimit,issueFileToken,purgeAttachmentSnapshot,safeFileDto,safeResourceDto,verifyFileToken} from "../lib/file-policy.mjs";

test('native artifact lists retain useful metadata without loading source code or raw tables',()=>{
 const project=safeResourceDto({kind:'deliverable',data:{format:'source-project',title:'Code',content:'Résumé',files:[{path:'index.js',content:'private source'}],history:[{files:'old source'}],executionConfirmed:false}});
 assert.equal(project.data.fileCount,1);assert.equal(project.data.content,'Résumé');assert.equal(project.data.files,undefined);assert.equal(project.data.history,undefined);
 const analysis=safeResourceDto({kind:'deliverable',data:{format:'data-analysis',title:'Mesures',analysis:{schema:1,inputHash:'hash',outputRows:500,rows:[['private values']],source:{input:'raw dataset'}},executionConfirmed:true}});
 assert.equal(analysis.data.analysis.outputRows,500);assert.equal(analysis.data.analysis.inputHash,'hash');assert.equal(analysis.data.analysis.rows,undefined);assert.equal(analysis.data.analysis.source,undefined);
});

test("file policy centralizes target upload limits",()=>{
 assert.equal(FILE_POLICY.maxFileBytes,52_428_800);
 assert.equal(FILE_POLICY.maxFilesPerMessage,10);
 assert.equal(FILE_POLICY.currentComposerMaxFiles,FILE_POLICY.maxFilesPerMessage);
 assert.equal(FILE_POLICY.chunkBytes,8*1024*1024);
 assert.equal(FILE_POLICY.maxParallelFiles,3);
 assert.equal(FILE_POLICY.maxParallelChunksPerFile,3);
 assert.equal(FILE_POLICY.maxPendingUploadBytesPerWorkspace,3*FILE_POLICY.maxFileBytes);
 assert.ok(FILE_POLICY.maxUploadBytesPerUserPerWindow>=FILE_POLICY.maxPendingUploadBytesPerWorkspace);
 assert.equal(FILE_POLICY.signedUrlTtlMs,300_000);
});

test("file types are derived from bytes, not file names",()=>{
 assert.equal(detectFileType(Uint8Array.from([137,80,78,71,13,10,26,10,0])),"image/png");
 assert.equal(detectFileType(new TextEncoder().encode("ordinary notes")),"text/plain");
 assert.equal(detectFileType(new TextEncoder().encode("not actually a png")),"text/plain");
 assert.equal(detectFileType(new Uint8Array()),null);
 assert.equal(declaredTypeMatches("image/png","text/plain"),false);
 assert.equal(declaredTypeMatches("text/markdown","text/plain"),true);
});

test("image dimensions fail closed above the configured megapixel limit",()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,39,17,0,0,39,16]);
 assert.equal(imageWithinPixelLimit(png,"image/png"),false);
 const safePng=png.slice();safePng[19]=0x04;safePng[23]=0x04;
 assert.equal(imageWithinPixelLimit(safePng,"image/png"),true);
 assert.equal(imageWithinPixelLimit(new Uint8Array([137,80,78,71,13,10,26,10]),"image/png"),false);
});

test("file and resource DTOs never expose storage or extracted content",()=>{
 const resource=safeResourceDto({id:"f1",kind:"file",title:"note.txt",data:{key:"private/object",text:"private excerpt",mime:"text/plain",size:4,sha256:"hash"}});
 assert.deepEqual(resource.data,{mime:"text/plain",size:4});
 assert.equal(safeFileDto({id:"f1",workspace_id:"w1",display_name:"note.txt",storage_key:"private/object",size_bytes:4,detected_mime:"text/plain",status:"ready",created_at:1,updated_at:2}).name,"note.txt");
 assert.equal(safeFileDto({id:"f1",workspace_id:"w1",display_name:"secret.txt",size_bytes:4,status:"deleted"}).name,"Fichier supprimé");
});

test("permanent retention removes only the deleted file snapshot and keeps the user's prompt",()=>{
 const result=purgeAttachmentSnapshot(JSON.stringify([{type:"text",text:"Analyse ceci"},{type:"text",text:"Pièce jointe non fiable: secret"},{type:"image",source:{data:"base64"}}]),JSON.stringify(["f1","f2"]),"f1");
 assert.deepEqual(JSON.parse(result.attachments),["f2"]);
 assert.deepEqual(JSON.parse(result.content),[{type:"text",text:"Analyse ceci"}]);
 assert.equal(purgeAttachmentSnapshot("[]","[]","f1"),null);
});

test("signed URLs are scoped to user, workspace, file, action and five-minute expiry",async()=>{
 const secret="unit-test-file-signing-secret-with-at-least-32-chars";
 const claims={fileId:"file-1",userId:"user-1",workspaceId:"space-1",scope:"content"};
 const token=await issueFileToken(secret,claims,1000);
 assert.equal(await verifyFileToken(secret,token,claims,1001),true);
 assert.equal(await verifyFileToken(secret,token,{...claims,scope:"download"},1001),false);
 assert.equal(await verifyFileToken(secret,token,{...claims,workspaceId:"space-2"},1001),false);
 assert.equal(await verifyFileToken(secret,token,claims,1000+FILE_POLICY.signedUrlTtlMs+1),false);
 const [payload,signature]=token.split(".");
 assert.equal(await verifyFileToken(secret,`${payload}.${signature.slice(1)}`,claims,1001),false);
});

test("active content headers force unsafe formats to download",()=>{
 const headers=contentSecurityHeaders("image/svg+xml","inline","unsafe.svg");
 assert.equal(headers["Content-Type"],"application/octet-stream");
 assert.match(headers["Content-Disposition"],/^attachment;/u);
 assert.equal(headers["X-Content-Type-Options"],"nosniff");
 assert.equal(headers["Content-Security-Policy"],"default-src 'none'; sandbox");
});
