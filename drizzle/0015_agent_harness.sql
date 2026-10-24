CREATE TABLE agent_checkpoints (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 conversation_id TEXT NOT NULL REFERENCES resources(id),
 version INTEGER NOT NULL DEFAULT 1,
 covered_rowid INTEGER NOT NULL,
 state TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,conversation_id)
);
--> statement-breakpoint
CREATE TABLE agent_plans (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 conversation_id TEXT NOT NULL REFERENCES resources(id),
 run_id TEXT NOT NULL REFERENCES runs(id),
 version INTEGER NOT NULL DEFAULT 1,
 objective TEXT NOT NULL,
 steps TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX agent_plans_conversation ON agent_plans(workspace_id,conversation_id,updated_at);
--> statement-breakpoint
CREATE TABLE agent_verifications (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 run_id TEXT NOT NULL REFERENCES runs(id),
 resource_id TEXT NOT NULL REFERENCES resources(id),
 resource_version INTEGER NOT NULL,
 result TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX agent_verifications_resource ON agent_verifications(workspace_id,resource_id,resource_version);
--> statement-breakpoint
CREATE TABLE agent_tool_receipts (
 workspace_id TEXT NOT NULL,
 run_id TEXT NOT NULL REFERENCES runs(id),
 fingerprint TEXT NOT NULL,
 tool TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','uncertain')),
 result TEXT,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,run_id,fingerprint)
);
