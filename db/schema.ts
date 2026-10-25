import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, foreignKey, check } from "drizzle-orm/sqlite-core";
export const workspaces=sqliteTable("workspaces",{organizationId:text("organization_id"),id:text("id").primaryKey(),name:text("name").notNull(),createdAt:integer("created_at").notNull(),credits:integer("credits").notNull().default(0),reserved:integer("reserved").notNull().default(0)});
export const members=sqliteTable("members",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull().references(()=>workspaces.id),userId:text("user_id").notNull(),role:text("role").notNull().default("owner")},t=>[uniqueIndex("membership").on(t.workspaceId,t.userId)]);
export const resources=sqliteTable("resources",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull().references(()=>workspaces.id),kind:text("kind").notNull(),title:text("title").notNull(),data:text("data").notNull().default("{}"),status:text("status").notNull().default("draft"),version:integer("version").notNull().default(1),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull()},t=>[index("resource_workspace").on(t.workspaceId,t.kind)]);
export const messages=sqliteTable("messages",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),conversationId:text("conversation_id").notNull().references(()=>resources.id),role:text("role").notNull(),content:text("content").notNull(),attachments:text("attachments").notNull().default("[]"),runId:text("run_id").references(()=>runs.id,{onDelete:"set null"}),createdAt:integer("created_at").notNull()},t=>[index("conversation_messages").on(t.conversationId,t.createdAt),index("message_run").on(t.workspaceId,t.runId),uniqueIndex("message_workspace_identity").on(t.id,t.workspaceId)]);
export const files=sqliteTable("files",{
 id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull().references(()=>workspaces.id),ownerId:text("owner_id"),legacyResourceId:text("legacy_resource_id"),
 displayName:text("display_name").notNull(),storageName:text("storage_name").notNull(),sizeBytes:integer("size_bytes").notNull().default(0),detectedMime:text("detected_mime").notNull().default("application/octet-stream"),
 sha256:text("sha256"),status:text("status").notNull().default("uploading"),storageKey:text("storage_key"),thumbnailKey:text("thumbnail_key"),extractionKey:text("extraction_key"),
 createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),deletedAt:integer("deleted_at")
},t=>[uniqueIndex("file_legacy_resource").on(t.legacyResourceId),uniqueIndex("file_workspace_sha256").on(t.workspaceId,t.sha256),index("file_workspace_status").on(t.workspaceId,t.status,t.updatedAt),index("file_deleted_at").on(t.status,t.deletedAt)]);
export const fileUploadAudit=sqliteTable("file_upload_audit",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),actorId:text("actor_id"),fileId:text("file_id"),action:text("action").notNull(),createdAt:integer("created_at").notNull()},t=>[index("file_audit_workspace_created").on(t.workspaceId,t.createdAt)]);
export const fileUploadLimits=sqliteTable("file_upload_limits",{userId:text("user_id").notNull(),windowStart:integer("window_start").notNull(),count:integer("count").notNull().default(0),bytes:integer("bytes").notNull().default(0)},t=>[uniqueIndex("file_upload_limits_user_window").on(t.userId,t.windowStart)]);
export const fileUploadSessions=sqliteTable("file_upload_sessions",{
 id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull().references(()=>workspaces.id),ownerId:text("owner_id").notNull(),fileId:text("file_id").notNull().references(()=>files.id,{onDelete:"cascade"}),
 multipartUploadId:text("multipart_upload_id").notNull(),storageKey:text("storage_key").notNull(),displayName:text("display_name").notNull(),storageName:text("storage_name").notNull(),
 declaredSize:integer("declared_size").notNull(),declaredMime:text("declared_mime").notNull().default(""),sha256:text("sha256").notNull(),partSize:integer("part_size").notNull(),partCount:integer("part_count").notNull(),
 status:text("status").notNull().default("uploading"),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull(),expiresAt:integer("expires_at").notNull()
},t=>[uniqueIndex("file_upload_session_file").on(t.fileId),index("file_upload_session_expiry").on(t.status,t.expiresAt),index("file_upload_session_owner").on(t.workspaceId,t.ownerId,t.status,t.createdAt)]);
export const fileUploadParts=sqliteTable("file_upload_parts",{
 uploadId:text("upload_id").notNull().references(()=>fileUploadSessions.id,{onDelete:"cascade"}),partNumber:integer("part_number").notNull(),etag:text("etag").notNull(),sha256:text("sha256").notNull(),sizeBytes:integer("size_bytes").notNull(),updatedAt:integer("updated_at").notNull()
},t=>[primaryKey({columns:[t.uploadId,t.partNumber]})]);
export const fileUploadPartLimits=sqliteTable("file_upload_part_limits",{
 userId:text("user_id").notNull(),windowStart:integer("window_start").notNull(),count:integer("count").notNull().default(0),bytes:integer("bytes").notNull().default(0)
},t=>[primaryKey({columns:[t.userId,t.windowStart]})]);
export const runs=sqliteTable("runs",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),conversationId:text("conversation_id").notNull(),status:text("status").notNull(),error:text("error"),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull()});
export const events=sqliteTable("events",{seq:integer("seq").primaryKey({autoIncrement:true}),runId:text("run_id").notNull().references(()=>runs.id),type:text("type").notNull(),data:text("data").notNull(),createdAt:integer("created_at").notNull()},t=>[index("run_events").on(t.runId,t.seq)]);
export const operations=sqliteTable("operations",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),resourceId:text("resource_id").notNull(),status:text("status").notNull(),amount:integer("amount").notNull().default(0),externalId:text("external_id"),detail:text("detail").notNull().default("{}"),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull()});
export const audit=sqliteTable("audit",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),actor:text("actor").notNull(),action:text("action").notNull(),target:text("target").notNull(),detail:text("detail").notNull().default("{}"),createdAt:integer("created_at").notNull()});
export const connections=sqliteTable("connections",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),provider:text("provider").notNull(),encryptedToken:text("encrypted_token").notNull(),expiresAt:integer("expires_at"),createdAt:integer("created_at").notNull()},t=>[uniqueIndex("workspace_provider").on(t.workspaceId,t.provider)]);
export const oauthStates=sqliteTable("oauth_states",{id:text("id").primaryKey(),workspaceId:text("workspace_id").notNull(),expiresAt:integer("expires_at").notNull()});

export * from "./billing-schema";
export * from "./composio-schema";
export * from "./runtime-schema";
export * from "./operations-schema";
export * from "./browser-schema";
export * from "./auth-schema";

export const responseFeedback=sqliteTable("response_feedback",{workspaceId:text("workspace_id").notNull(),userId:text("user_id").notNull(),messageId:text("message_id").notNull(),feedback:text("feedback",{enum:["up","down"]}),createdAt:integer("created_at").notNull(),updatedAt:integer("updated_at").notNull()},t=>[primaryKey({columns:[t.workspaceId,t.userId,t.messageId]}),foreignKey({columns:[t.messageId,t.workspaceId],foreignColumns:[messages.id,messages.workspaceId]}).onDelete("cascade"),check("response_feedback_value",sql`${t.feedback} IN ('up','down') OR ${t.feedback} IS NULL`)]);

export * from "./platform-schema";
