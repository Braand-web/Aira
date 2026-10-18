import {sqliteTable,text,integer,index,uniqueIndex,primaryKey} from 'drizzle-orm/sqlite-core';
// Relations are enforced by migration 0009_runtime.sql; no cycle with the root schema.
export const pagePublications=sqliteTable('page_publications',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),organizationId:text('organization_id').notNull(),resourceId:text('resource_id').notNull().unique(),resourceVersion:integer('resource_version').notNull(),snapshot:text('snapshot').notNull(),digest:text('digest').notNull(),status:text('status').notNull(),approvedBy:text('approved_by'),approvedAt:integer('approved_at'),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
});
export const pageLeads=sqliteTable('page_leads',{
 id:text('id').primaryKey(),publicationId:text('publication_id').notNull().references(()=>pagePublications.id),workspaceId:text('workspace_id').notNull(),name:text('name').notNull(),email:text('email').notNull(),message:text('message').notNull(),createdAt:integer('created_at').notNull()
},t=>[index('page_leads_workspace').on(t.workspaceId,t.publicationId,t.createdAt,t.id)]);
export const pageFormLimits=sqliteTable('page_form_limits',{key:text('key').notNull(),bucket:integer('bucket').notNull(),count:integer('count').notNull()},t=>[primaryKey({columns:[t.key,t.bucket]})]);
export const durableMissions=sqliteTable('durable_missions',{
 id:text('id').primaryKey(),workspaceId:text('workspace_id').notNull(),organizationId:text('organization_id').notNull(),actorId:text('actor_id').notNull(),approvedVersion:integer('approved_version').notNull(),mandate:text('mandate').notNull(),status:text('status').notNull(),cursor:integer('cursor').notNull().default(0),budgetUnits:integer('budget_units').notNull(),spentUnits:integer('spent_units').notNull().default(0),reservedUnits:integer('reserved_units').notNull().default(0),expiresAt:integer('expires_at').notNull(),nextAt:integer('next_at').notNull(),leaseToken:text('lease_token'),leaseUntil:integer('lease_until').notNull().default(0),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
},t=>[index('durable_missions_due').on(t.status,t.nextAt,t.leaseUntil)]);
export const durableSteps=sqliteTable('durable_steps',{
 id:text('id').primaryKey(),missionId:text('mission_id').notNull().references(()=>durableMissions.id),ordinal:integer('ordinal').notNull(),status:text('status').notNull(),runId:text('run_id').unique(),conversationId:text('conversation_id').notNull(),reservedUnits:integer('reserved_units').notNull(),result:text('result'),error:text('error'),startedAt:integer('started_at').notNull(),finishedAt:integer('finished_at')
},t=>[uniqueIndex('durable_steps_mission_ordinal').on(t.missionId,t.ordinal)]);
