CREATE TABLE page_publications (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 organization_id TEXT NOT NULL,
 resource_id TEXT NOT NULL UNIQUE REFERENCES resources(id),
 resource_version INTEGER NOT NULL,
 snapshot TEXT NOT NULL,
 digest TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('awaiting_approval','published','suspended')),
 approved_by TEXT,
 approved_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE page_leads (
 id TEXT PRIMARY KEY,
 publication_id TEXT NOT NULL REFERENCES page_publications(id),
 workspace_id TEXT NOT NULL,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX page_leads_workspace ON page_leads(workspace_id,publication_id,created_at,id);
--> statement-breakpoint
CREATE TABLE page_form_limits (
 key TEXT NOT NULL,
 bucket INTEGER NOT NULL,
 count INTEGER NOT NULL,
 PRIMARY KEY(key,bucket)
);
--> statement-breakpoint
CREATE TABLE durable_missions (
 id TEXT PRIMARY KEY REFERENCES resources(id),
 workspace_id TEXT NOT NULL,
 organization_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 approved_version INTEGER NOT NULL,
 mandate TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','running','waiting_user','suspended','completed','failed','cancelled')),
 cursor INTEGER NOT NULL DEFAULT 0,
 budget_units INTEGER NOT NULL,
 spent_units INTEGER NOT NULL DEFAULT 0,
 reserved_units INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL,
 next_at INTEGER NOT NULL,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX durable_missions_due ON durable_missions(status,next_at,lease_until);
--> statement-breakpoint
CREATE TABLE durable_steps (
 id TEXT PRIMARY KEY,
 mission_id TEXT NOT NULL REFERENCES durable_missions(id),
 ordinal INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','completed','uncertain','failed')),
 run_id TEXT UNIQUE,
 conversation_id TEXT NOT NULL,
 reserved_units INTEGER NOT NULL,
 result TEXT,
 error TEXT,
 started_at INTEGER NOT NULL,
 finished_at INTEGER,
 UNIQUE(mission_id,ordinal)
);
