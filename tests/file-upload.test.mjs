import test from "node:test";
import assert from "node:assert/strict";
import {FILE_POLICY} from "../lib/file-policy.mjs";
import {fileUploadPartCount,fileUploadPartSize,isSha256,publicUploadSession,uploadSessionExpired} from "../lib/file-upload.mjs";

test("resumable upload splits files on the configured chunk boundary",()=>{
 assert.equal(fileUploadPartCount(0),0);
 assert.equal(fileUploadPartCount(1),1);
 assert.equal(fileUploadPartCount(FILE_POLICY.chunkBytes),1);
 assert.equal(fileUploadPartCount(FILE_POLICY.chunkBytes+1),2);
 assert.equal(fileUploadPartCount(FILE_POLICY.maxFileBytes),Math.ceil(FILE_POLICY.maxFileBytes/FILE_POLICY.chunkBytes));
 assert.equal(fileUploadPartCount(FILE_POLICY.maxFileBytes+1),0);
 assert.equal(fileUploadPartSize(FILE_POLICY.chunkBytes+1,1),FILE_POLICY.chunkBytes);
 assert.equal(fileUploadPartSize(FILE_POLICY.chunkBytes+1,2),1);
 assert.equal(fileUploadPartSize(FILE_POLICY.chunkBytes+1,3),0);
});

test("only full SHA-256 digests are accepted",()=>{
 assert.equal(isSha256("a".repeat(64)),true);
 assert.equal(isSha256("A".repeat(64)),true);
 assert.equal(isSha256("a".repeat(63)),false);
 assert.equal(isSha256("g".repeat(64)),false);
 assert.equal(isSha256(null),false);
});

test("public resumable-upload metadata never exposes storage internals",()=>{
 const dto=publicUploadSession({id:"public-id",file_id:"file-id",display_name:"exemple.pdf",declared_size:11,declared_mime:"application/pdf",sha256:"a".repeat(64),part_size:8,part_count:2,expires_at:200,status:"uploading",storage_key:"private/key",multipart_upload_id:"private-r2-id"},[{part_number:1,size_bytes:8,sha256:"b".repeat(64)}]);
 assert.deepEqual(dto,{uploadId:"public-id",fileId:"file-id",name:"exemple.pdf",size:11,mime:"application/pdf",sha256:"a".repeat(64),chunkBytes:8,partCount:2,uploadedParts:[{partNumber:1,size:8,sha256:"b".repeat(64)}],expiresAt:200,status:"uploading"});
 assert.equal("storage_key" in dto,false);
 assert.equal("multipart_upload_id" in dto,false);
});

test("upload sessions expire at their server-side deadline",()=>{
 assert.equal(uploadSessionExpired({expires_at:100},99),false);
 assert.equal(uploadSessionExpired({expires_at:100},100),true);
 assert.equal(uploadSessionExpired(null,99),true);
});
