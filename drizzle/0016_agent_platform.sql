-- Additive agent work, drafts, research and exact social mandates. Existing data is retained.
CREATE TABLE agent_work (
 id TEXT PRIMARY KEY REFERENCES resources(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 organization_id TEXT NOT NULL, actor_id TEXT NOT NULL, conversation_id TEXT NOT NULL REFERENCES resources(id),
 objective TEXT NOT NULL, constraints_json TEXT NOT NULL DEFAULT '[]', language TEXT NOT NULL DEFAULT 'fr', timezone TEXT NOT NULL DEFAULT 'UTC', research_depth TEXT NOT NULL DEFAULT 'standard' CHECK(research_depth IN ('standard','deep')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','waiting_input','waiting_approval','waiting_external','paused','needs_reconciliation','completed','partial','failed','cancelled','expired')),
 version INTEGER NOT NULL DEFAULT 1, approved_version INTEGER, budget_units INTEGER NOT NULL CHECK(budget_units>0),
 expires_at INTEGER NOT NULL, next_at INTEGER NOT NULL, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 error_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX agent_work_due ON agent_work(status,next_at,lease_until);
CREATE INDEX agent_work_space ON agent_work(workspace_id,conversation_id,updated_at);
CREATE TABLE agent_work_steps (
 id TEXT PRIMARY KEY, work_id TEXT NOT NULL REFERENCES agent_work(id), ordinal INTEGER NOT NULL,
 title TEXT NOT NULL, instruction TEXT NOT NULL, criteria TEXT NOT NULL, depends_on TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','waiting_input','waiting_approval','waiting_external','completed','partial','failed','uncertain','cancelled')),
 max_units INTEGER NOT NULL CHECK(max_units>0), run_id TEXT UNIQUE, result TEXT, started_at INTEGER, finished_at INTEGER,
 UNIQUE(work_id,ordinal)
);
CREATE TABLE agent_work_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, work_id TEXT NOT NULL REFERENCES agent_work(id), type TEXT NOT NULL,
 data TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
CREATE INDEX agent_work_event_cursor ON agent_work_events(work_id,seq);
CREATE TABLE agent_work_artifacts (
 work_id TEXT NOT NULL REFERENCES agent_work(id), step_id TEXT NOT NULL REFERENCES agent_work_steps(id),
 resource_id TEXT NOT NULL REFERENCES resources(id), PRIMARY KEY(work_id,resource_id)
);
CREATE TABLE agent_work_allocations (
 work_id TEXT NOT NULL REFERENCES agent_work(id), reference TEXT NOT NULL UNIQUE,
 max_units INTEGER NOT NULL CHECK(max_units>=0), hold_id TEXT, PRIMARY KEY(work_id,reference)
);
CREATE TABLE agent_work_outbox (
 id TEXT PRIMARY KEY, work_id TEXT NOT NULL REFERENCES agent_work(id), status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX agent_work_outbox_due ON agent_work_outbox(status,next_at);
CREATE TABLE agent_work_commands (
 workspace_id TEXT NOT NULL, command_id TEXT NOT NULL, work_id TEXT NOT NULL REFERENCES agent_work(id),
 action TEXT NOT NULL, result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,command_id)
);
CREATE TABLE agent_work_tool_receipts (
 workspace_id TEXT NOT NULL, work_id TEXT NOT NULL REFERENCES agent_work(id), fingerprint TEXT NOT NULL,
 tool TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','uncertain')), result TEXT, updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,work_id,fingerprint)
);
CREATE TABLE composer_drafts (
 workspace_id TEXT NOT NULL REFERENCES workspaces(id), user_id TEXT NOT NULL, context_id TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, content TEXT NOT NULL DEFAULT '', attachments TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,user_id,context_id)
);
CREATE TABLE research_sources (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), conversation_id TEXT NOT NULL REFERENCES resources(id),
 run_id TEXT NOT NULL REFERENCES runs(id), url TEXT NOT NULL, title TEXT NOT NULL, accessed_at INTEGER NOT NULL,
 published_at TEXT, excerpt TEXT NOT NULL, digest TEXT NOT NULL, access_kind TEXT NOT NULL CHECK(access_kind IN ('search_excerpt','page_read')),
 linked_resource_id TEXT REFERENCES resources(id), expires_at INTEGER NOT NULL
);
CREATE INDEX research_source_scope ON research_sources(workspace_id,conversation_id,accessed_at);
CREATE TABLE agent_tool_usage (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES runs(id), hold_id TEXT NOT NULL,
 provider TEXT NOT NULL, operation TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','complete','unknown','rejected')),
 ceiling_units INTEGER NOT NULL CHECK(ceiling_units>=0), actual_units INTEGER, rate TEXT NOT NULL,
 receipt_id TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX agent_tool_usage_hold ON agent_tool_usage(hold_id,status);
CREATE TABLE social_accounts (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), actor_id TEXT NOT NULL,
 network TEXT NOT NULL CHECK(network IN ('instagram','facebook','linkedin','tiktok')),
 connected_account_id TEXT NOT NULL, target_id TEXT NOT NULL, label TEXT NOT NULL, timezone TEXT NOT NULL,
 capabilities TEXT NOT NULL, evidence TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unverified',
 version INTEGER NOT NULL DEFAULT 1, verified_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(workspace_id,actor_id,network,connected_account_id,target_id)
);
CREATE TABLE social_batches (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), actor_id TEXT NOT NULL,
 title TEXT NOT NULL, brand_id TEXT, project_id TEXT, status TEXT NOT NULL DEFAULT 'draft',
 version INTEGER NOT NULL DEFAULT 1, digest TEXT, approved_by TEXT, approved_at INTEGER, expires_at INTEGER,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
, decision_token TEXT
);
CREATE INDEX social_batches_space ON social_batches(workspace_id,updated_at);
CREATE TABLE social_posts (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES social_batches(id), workspace_id TEXT NOT NULL,
 account_id TEXT NOT NULL REFERENCES social_accounts(id), text TEXT NOT NULL, assets TEXT NOT NULL DEFAULT '[]',
 format TEXT NOT NULL, alt_text TEXT NOT NULL DEFAULT '', destination TEXT, scheduled_at INTEGER NOT NULL,
 timezone TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1,
 approved_by TEXT, approved_at INTEGER, approval_expires_at INTEGER, approved_digest TEXT, receipt TEXT, error_code TEXT, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX social_posts_due ON social_posts(status,scheduled_at,lease_until);
CREATE INDEX social_posts_space ON social_posts(workspace_id,batch_id);
CREATE TABLE social_deliveries (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL UNIQUE REFERENCES social_posts(id), workspace_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, adapter_digest TEXT NOT NULL, payload_digest TEXT NOT NULL, status TEXT NOT NULL,
 external_id TEXT, public_url TEXT, log_id TEXT, detail TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE social_comments (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES social_accounts(id),
 external_id TEXT NOT NULL, post_external_id TEXT NOT NULL, parent_external_id TEXT, author_label TEXT NOT NULL,
 text TEXT NOT NULL, digest TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unread', published_at INTEGER,
 synced_at INTEGER NOT NULL, UNIQUE(account_id,external_id)
);
CREATE TABLE social_delivery_steps (
 delivery_id TEXT NOT NULL REFERENCES social_deliveries(id), ordinal INTEGER NOT NULL, tool_slug TEXT NOT NULL,
 payload_digest TEXT NOT NULL, status TEXT NOT NULL, result TEXT, log_id TEXT, updated_at INTEGER NOT NULL,
 PRIMARY KEY(delivery_id,ordinal)
);
CREATE TABLE social_asset_grants (
 id TEXT PRIMARY KEY, token_digest TEXT NOT NULL, delivery_id TEXT NOT NULL REFERENCES social_deliveries(id),
 file_id TEXT NOT NULL REFERENCES files(id), file_digest TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE social_replies (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL, comment_id TEXT NOT NULL REFERENCES social_comments(id),
 text TEXT NOT NULL, comment_digest TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft',
 digest TEXT NOT NULL, approved_by TEXT, payload_digest TEXT, receipt TEXT, updated_at INTEGER NOT NULL
);
CREATE TABLE social_insights (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES social_accounts(id),
 external_post_id TEXT, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, metrics TEXT NOT NULL,
 source TEXT NOT NULL, fetched_at INTEGER NOT NULL
);
CREATE INDEX social_insights_period ON social_insights(workspace_id,account_id,period_start,period_end);
CREATE TABLE media_assets (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), resource_id TEXT NOT NULL REFERENCES resources(id),
 file_id TEXT NOT NULL REFERENCES files(id), resource_version INTEGER NOT NULL, position INTEGER NOT NULL,
 digest TEXT NOT NULL, metadata TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(resource_id,position)
);
CREATE TABLE media_render_jobs (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, organization_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 proposal_id TEXT NOT NULL UNIQUE REFERENCES resources(id), proposal_version INTEGER NOT NULL,
 digest TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', hold_id TEXT NOT NULL, max_units INTEGER NOT NULL,
 external_id TEXT, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, result TEXT, error_code TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE research_runs(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,conversation_id TEXT NOT NULL,run_id TEXT NOT NULL,usage_id TEXT NOT NULL,transport TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX research_runs_expiry ON research_runs(expires_at);
