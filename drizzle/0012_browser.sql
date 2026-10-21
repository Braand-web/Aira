CREATE TABLE browser_sessions (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
 objective TEXT NOT NULL, conversation_id TEXT, allowed_domains TEXT NOT NULL, profile_id TEXT,
 status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1, control TEXT NOT NULL DEFAULT 'agent',
 max_credits REAL NOT NULL CHECK(max_credits>0), max_actions INTEGER NOT NULL DEFAULT 40, max_seconds INTEGER NOT NULL DEFAULT 1200,
 actions_used INTEGER NOT NULL DEFAULT 0, seconds_used INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 0,
 org_concurrency INTEGER NOT NULL DEFAULT 1, provider_id TEXT, provider_state TEXT NOT NULL DEFAULT 'new', observation TEXT, capture_id TEXT,
 hold_id TEXT, run_id TEXT, model_rate TEXT, browser_rate TEXT, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 started_at INTEGER, human_since INTEGER, human_page_id TEXT, result_summary TEXT, result_created_at INTEGER, last_error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX browser_one_active_user_workspace ON browser_sessions(workspace_id,user_id) WHERE active=1;
CREATE INDEX browser_session_owner ON browser_sessions(workspace_id,user_id,updated_at);
CREATE INDEX browser_session_expiry ON browser_sessions(active,expires_at);
CREATE TRIGGER browser_organization_concurrency BEFORE UPDATE OF active ON browser_sessions
 WHEN NEW.active=1 AND OLD.active=0 AND (SELECT COUNT(*) FROM browser_sessions WHERE organization_id=NEW.organization_id AND active=1)>=NEW.org_concurrency
 BEGIN SELECT RAISE(ABORT,'browser_concurrency_limit'); END;
CREATE TABLE browser_actions (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
 version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', command TEXT NOT NULL,
 description TEXT NOT NULL, digest TEXT NOT NULL, observation_id TEXT NOT NULL, page_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, decided_at INTEGER
);
CREATE UNIQUE INDEX browser_one_pending_action ON browser_actions(session_id) WHERE status IN ('pending','executing');
CREATE TABLE browser_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
 type TEXT NOT NULL, status TEXT NOT NULL, domain TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX browser_event_cursor ON browser_events(session_id,seq);
CREATE TABLE browser_profiles (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), user_id TEXT NOT NULL,
 name TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX browser_profile_owner ON browser_profiles(workspace_id,user_id,expires_at);
CREATE TABLE browser_artifacts (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, storage_key TEXT NOT NULL UNIQUE,
 file_id TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX browser_artifact_expiry ON browser_artifacts(expires_at);
CREATE TABLE browser_usage (
 session_id TEXT PRIMARY KEY REFERENCES browser_sessions(id), hold_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown',
 milliseconds INTEGER, units INTEGER, source TEXT NOT NULL DEFAULT 'provider_history', updated_at INTEGER NOT NULL
);
CREATE INDEX browser_usage_hold ON browser_usage(hold_id,status);
