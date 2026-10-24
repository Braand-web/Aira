import {sqliteTable, text, integer, index} from 'drizzle-orm/sqlite-core';

export const authUsers = sqliteTable('auth_users', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(),
  verifiedAt: integer('verified_at').notNull(), createdAt: integer('created_at').notNull(),
});
export const authChallenges = sqliteTable('auth_challenges', {
  id: text('id').primaryKey(), email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(), browserHash: text('browser_hash').notNull(),
  expiresAt: integer('expires_at').notNull(), returnTo: text('return_to').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('auth_challenges_expiry').on(table.expiresAt)]);
export const authSessions = sqliteTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => authUsers.id, {onDelete:'cascade'}),
  expiresAt: integer('expires_at').notNull(), createdAt: integer('created_at').notNull(),
}, table => [index('auth_sessions_expiry').on(table.expiresAt)]);
export const authRateLimits = sqliteTable('auth_rate_limits', {
  bucket: text('bucket').primaryKey(), count: integer('count').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
});
