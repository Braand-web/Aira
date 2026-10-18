CREATE TABLE operations_jobs (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','blocked','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 result TEXT,
 error_code TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX operations_jobs_status ON operations_jobs(status,updated_at);
--> statement-breakpoint
CREATE TABLE operations_alerts (
 id TEXT PRIMARY KEY,
 category TEXT NOT NULL,
 target TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 observations INTEGER NOT NULL DEFAULT 1,
 first_seen_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY,
 template TEXT NOT NULL,
 payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','blocked','failed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT,
 error_code TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX notification_outbox_due ON notification_outbox(status,created_at);
--> statement-breakpoint
CREATE TABLE operations_backups (
 id TEXT PRIMARY KEY,
 object_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('completed')),
 bytes INTEGER NOT NULL,
 tables_count INTEGER NOT NULL,
 rows_count INTEGER NOT NULL,
 objects_count INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
