import {sqliteTable, text, integer, index} from 'drizzle-orm/sqlite-core';

export const operationsJobs = sqliteTable('operations_jobs', {
  id: text('id').primaryKey(), name: text('name').notNull(), status: text('status').notNull(),
  attempts: integer('attempts').notNull().default(0), leaseToken: text('lease_token'),
  leaseUntil: integer('lease_until').notNull().default(0), result: text('result'), errorCode: text('error_code'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [index('operations_jobs_status').on(t.status, t.updatedAt)]);
export const operationsAlerts = sqliteTable('operations_alerts', {
  id: text('id').primaryKey(), category: text('category').notNull(), target: text('target').notNull(),
  status: text('status').notNull().default('open'), observations: integer('observations').notNull().default(1),
  firstSeenAt: integer('first_seen_at').notNull(), lastSeenAt: integer('last_seen_at').notNull(),
});
export const notificationOutbox = sqliteTable('notification_outbox', {
  id: text('id').primaryKey(), template: text('template').notNull(), payload: text('payload').notNull(),
  status: text('status').notNull().default('pending'), attempts: integer('attempts').notNull().default(0),
  leaseToken: text('lease_token'), leaseUntil: integer('lease_until').notNull().default(0),
  providerId: text('provider_id'), errorCode: text('error_code'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, t => [index('notification_outbox_due').on(t.status, t.createdAt)]);
export const operationsBackups = sqliteTable('operations_backups', {
  id: text('id').primaryKey(), objectKey: text('object_key').notNull().unique(),
  status: text('status').notNull(), bytes: integer('bytes').notNull(), tablesCount: integer('tables_count').notNull(),
  rowsCount: integer('rows_count').notNull(), objectsCount: integer('objects_count').notNull(),
  createdAt: integer('created_at').notNull(),
});
