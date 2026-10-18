import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
import {resources} from './schema';

export const connectorSessions=sqliteTable('connector_sessions',{
 workspaceId:text('workspace_id').notNull(),userId:text('user_id').notNull(),conversationId:text('conversation_id').notNull(),
 sessionId:text('session_id').notNull(),scopeUser:text('scope_user').notNull(),mode:text('mode').notNull().default('connected'),createdAt:integer('created_at').notNull()
},t=>[primaryKey({columns:[t.workspaceId,t.userId,t.conversationId,t.mode]})]);
export const connectorActions=sqliteTable('connector_actions',{
 id:text('id').primaryKey().references(()=>resources.id),workspaceId:text('workspace_id').notNull(),organizationId:text('organization_id').notNull(),
 userId:text('user_id').notNull(),sessionId:text('session_id').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('pending'),
 expiresAt:integer('expires_at').notNull(),createdAt:integer('created_at').notNull(),result:text('result'),logId:text('log_id'),holdId:text('hold_id'),
 maxMicros:integer('max_micros').notNull().default(0),actualMicros:integer('actual_micros'),month:text('month').notNull(),userLimit:integer('user_limit').notNull(),orgLimit:integer('org_limit').notNull()
},t=>[index('connector_budget').on(t.organizationId,t.month,t.status)]);
