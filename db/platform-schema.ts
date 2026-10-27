import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
// Migration 0017 is authoritative for finite routine constraints and indexes.
export const agentRoutines=sqliteTable('agent_routines',{
    id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),organizationId:text('organization_id').notNull(),actorId:text('actor_id').notNull(),sourceWorkId:text('source_work_id').notNull(),
    title:text('title').notNull(),templateJson:text('template_json').notNull(),templateDigest:text('template_digest').notNull(),intervalHours:integer('interval_hours').notNull(),firstAt:integer('first_at').notNull(),nextAt:integer('next_at').notNull(),expiresAt:integer('expires_at').notNull(),
    maxRuns:integer('max_runs').notNull(),budgetUnits:integer('budget_units').notNull(),perRunUnits:integer('per_run_units').notNull(),status:text('status').notNull().default('draft'),version:integer('version').notNull().default(1),approvedBy:text('approved_by'),approvedAt:integer('approved_at'),errorCode:text('error_code'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
});
export const agentRoutineRuns=sqliteTable('agent_routine_runs',{
    routineId:text('routine_id').notNull(),ordinal:integer('ordinal').notNull(),scheduledAt:integer('scheduled_at').notNull(),workId:text('work_id').notNull().unique(),createdAt:integer('created_at').notNull(),
},t=>[primaryKey({columns:[t.routineId,t.ordinal]})]);
// Additive SQL migration 0016 is authoritative for foreign keys, checks and indexes.
export const agentWork = sqliteTable('agent_work', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    organizationId: text("organization_id").notNull(),
    actorId: text("actor_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    objective: text("objective").notNull(),
    constraintsJson: text("constraints_json").notNull().default(sql.raw("'[]'")),
    language: text("language").notNull().default(sql.raw("'fr'")),
    timezone: text("timezone").notNull().default(sql.raw("'UTC'")),
    researchDepth: text("research_depth").notNull().default(sql.raw("'standard'")),
    status: text("status").notNull().default(sql.raw("'draft'")),
    version: integer("version").notNull().default(sql.raw("1")),
    approvedVersion: integer("approved_version"),
    budgetUnits: integer("budget_units").notNull(),
    expiresAt: integer("expires_at").notNull(),
    nextAt: integer("next_at").notNull(),
    leaseToken: text("lease_token"),
    leaseUntil: integer("lease_until").notNull().default(sql.raw("0")),
    errorCode: text("error_code"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});
export const agentWorkSteps = sqliteTable('agent_work_steps', {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    criteria: text("criteria").notNull(),
    dependsOn: text("depends_on").notNull(),
    status: text("status").notNull().default(sql.raw("'pending'")),
    maxUnits: integer("max_units").notNull(),
    runId: text("run_id"),
    result: text("result"),
    startedAt: integer("started_at"),
    finishedAt: integer("finished_at")
});
export const agentWorkEvents = sqliteTable('agent_work_events', {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    workId: text("work_id").notNull(),
    type: text("type").notNull(),
    data: text("data").notNull().default(sql.raw("'{}'")),
    createdAt: integer("created_at").notNull()
});
export const agentWorkArtifacts = sqliteTable('agent_work_artifacts', {
    workId: text("work_id").notNull(),
    stepId: text("step_id").notNull(),
    resourceId: text("resource_id").notNull()
}, t => [primaryKey({ columns: [t.workId, t.resourceId] })]);
export const agentWorkAllocations = sqliteTable('agent_work_allocations', {
    workId: text("work_id").notNull(),
    reference: text("reference").notNull(),
    maxUnits: integer("max_units").notNull(),
    holdId: text("hold_id")
}, t => [primaryKey({ columns: [t.workId, t.reference] })]);
export const agentWorkOutbox = sqliteTable('agent_work_outbox', {
    id: text("id").primaryKey(),
    workId: text("work_id").notNull(),
    status: text("status").notNull().default(sql.raw("'pending'")),
    attempts: integer("attempts").notNull().default(sql.raw("0")),
    nextAt: integer("next_at").notNull(),
    createdAt: integer("created_at").notNull()
});
export const agentWorkCommands = sqliteTable('agent_work_commands', {
    workspaceId: text("workspace_id").notNull(),
    commandId: text("command_id").notNull(),
    workId: text("work_id").notNull(),
    action: text("action").notNull(),
    result: text("result").notNull(),
    createdAt: integer("created_at").notNull()
}, t => [primaryKey({ columns: [t.workspaceId, t.commandId] })]);
export const agentWorkToolReceipts = sqliteTable('agent_work_tool_receipts', {
    workspaceId: text("workspace_id").notNull(),
    workId: text("work_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    tool: text("tool").notNull(),
    status: text("status").notNull(),
    result: text("result"),
    updatedAt: integer("updated_at").notNull()
}, t => [primaryKey({ columns: [t.workspaceId, t.workId, t.fingerprint] })]);
export const composerDrafts = sqliteTable('composer_drafts', {
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    contextId: text("context_id").notNull(),
    version: integer("version").notNull().default(sql.raw("1")),
    content: text("content").notNull().default(sql.raw("''")),
    attachments: text("attachments").notNull().default(sql.raw("'[]'")),
    updatedAt: integer("updated_at").notNull()
}, t => [primaryKey({ columns: [t.workspaceId, t.userId, t.contextId] })]);
export const researchSources = sqliteTable('research_sources', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    runId: text("run_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    accessedAt: integer("accessed_at").notNull(),
    publishedAt: text("published_at"),
    excerpt: text("excerpt").notNull(),
    digest: text("digest").notNull(),
    accessKind: text("access_kind").notNull(),
    linkedResourceId: text("linked_resource_id"),
    expiresAt: integer("expires_at").notNull()
});
export const agentToolUsage = sqliteTable('agent_tool_usage', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    runId: text("run_id").notNull(),
    holdId: text("hold_id").notNull(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    status: text("status").notNull(),
    ceilingUnits: integer("ceiling_units").notNull(),
    actualUnits: integer("actual_units"),
    rate: text("rate").notNull(),
    receiptId: text("receipt_id"),
    createdAt: integer("created_at").notNull()
});
export const socialAccounts = sqliteTable('social_accounts', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id").notNull(),
    network: text("network").notNull(),
    connectedAccountId: text("connected_account_id").notNull(),
    targetId: text("target_id").notNull(),
    label: text("label").notNull(),
    timezone: text("timezone").notNull(),
    capabilities: text("capabilities").notNull(),
    evidence: text("evidence").notNull(),
    status: text("status").notNull().default(sql.raw("'unverified'")),
    version: integer("version").notNull().default(sql.raw("1")),
    verifiedAt: integer("verified_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});
export const socialBatches = sqliteTable('social_batches', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id").notNull(),
    title: text("title").notNull(),
    brandId: text("brand_id"),
    projectId: text("project_id"),
    status: text("status").notNull().default(sql.raw("'draft'")),
    version: integer("version").notNull().default(sql.raw("1")),
    digest: text("digest"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    decisionToken: text("decision_token")
});
export const socialPosts = sqliteTable('social_posts', {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    accountId: text("account_id").notNull(),
    text: text("text").notNull(),
    assets: text("assets").notNull().default(sql.raw("'[]'")),
    format: text("format").notNull(),
    altText: text("alt_text").notNull().default(sql.raw("''")),
    destination: text("destination"),
    scheduledAt: integer("scheduled_at").notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default(sql.raw("'draft'")),
    version: integer("version").notNull().default(sql.raw("1")),
    approvedBy:text("approved_by"),approvedAt:integer("approved_at"),approvalExpiresAt:integer("approval_expires_at"),
    approvedDigest: text("approved_digest"),
    receipt: text("receipt"),
    errorCode: text("error_code"),
    leaseToken: text("lease_token"),
    leaseUntil: integer("lease_until").notNull().default(sql.raw("0")),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});
export const socialDeliveries = sqliteTable('social_deliveries', {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id").notNull(),
    adapterDigest: text("adapter_digest").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    status: text("status").notNull(),
    externalId: text("external_id"),
    publicUrl: text("public_url"),
    logId: text("log_id"),
    detail: text("detail").notNull().default(sql.raw("'{}'")),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});
export const socialComments = sqliteTable('social_comments', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    accountId: text("account_id").notNull(),
    externalId: text("external_id").notNull(),
    postExternalId: text("post_external_id").notNull(),
    parentExternalId: text("parent_external_id"),
    authorLabel: text("author_label").notNull(),
    text: text("text").notNull(),
    digest: text("digest").notNull(),
    status: text("status").notNull().default(sql.raw("'unread'")),
    publishedAt: integer("published_at"),
    syncedAt: integer("synced_at").notNull()
});
export const socialDeliverySteps = sqliteTable('social_delivery_steps', {
    deliveryId: text("delivery_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    toolSlug: text("tool_slug").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    status: text("status").notNull(),
    result: text("result"),
    logId: text("log_id"),
    updatedAt: integer("updated_at").notNull()
}, t => [primaryKey({ columns: [t.deliveryId, t.ordinal] })]);
export const socialAssetGrants = sqliteTable('social_asset_grants', {
    id: text("id").primaryKey(),
    tokenDigest: text("token_digest").notNull(),
    deliveryId: text("delivery_id").notNull(),
    fileId: text("file_id").notNull(),
    fileDigest: text("file_digest").notNull(),
    expiresAt: integer("expires_at").notNull()
});
export const socialReplies = sqliteTable('social_replies', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id").notNull(),
    commentId: text("comment_id").notNull(),
    text: text("text").notNull(),
    commentDigest: text("comment_digest").notNull(),
    version: integer("version").notNull().default(sql.raw("1")),
    status: text("status").notNull().default(sql.raw("'draft'")),
    digest: text("digest").notNull(),
    approvedBy: text("approved_by"),
    payloadDigest: text("payload_digest"),
    receipt: text("receipt"),
    updatedAt: integer("updated_at").notNull()
});
export const socialInsights = sqliteTable('social_insights', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    accountId: text("account_id").notNull(),
    externalPostId: text("external_post_id"),
    periodStart: integer("period_start").notNull(),
    periodEnd: integer("period_end").notNull(),
    metrics: text("metrics").notNull(),
    source: text("source").notNull(),
    fetchedAt: integer("fetched_at").notNull()
});
export const mediaAssets = sqliteTable('media_assets', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    resourceId: text("resource_id").notNull(),
    fileId: text("file_id").notNull(),
    resourceVersion: integer("resource_version").notNull(),
    position: integer("position").notNull(),
    digest: text("digest").notNull(),
    metadata: text("metadata").notNull(),
    createdAt: integer("created_at").notNull()
});
export const mediaRenderJobs = sqliteTable('media_render_jobs', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    organizationId: text("organization_id").notNull(),
    actorId: text("actor_id").notNull(),
    proposalId: text("proposal_id").notNull(),
    proposalVersion: integer("proposal_version").notNull(),
    digest: text("digest").notNull(),
    status: text("status").notNull().default(sql.raw("'queued'")),
    holdId: text("hold_id").notNull(),
    maxUnits: integer("max_units").notNull(),
    externalId: text("external_id"),
    leaseToken: text("lease_token"),
    leaseUntil: integer("lease_until").notNull().default(sql.raw("0")),
    result: text("result"),
    errorCode: text("error_code"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});
export const researchRuns = sqliteTable('research_runs', {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    runId: text("run_id").notNull(),
    usageId: text("usage_id").notNull(),
    transport: text("transport").notNull(),
    payload: text("payload").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull()
});
