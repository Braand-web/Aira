-- Finite, explicitly approved repetitions of a completed work mandate.
CREATE TABLE agent_routines (
 id TEXT PRIMARY KEY REFERENCES resources(id), workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 organization_id TEXT NOT NULL, actor_id TEXT NOT NULL, source_work_id TEXT NOT NULL REFERENCES agent_work(id),
 title TEXT NOT NULL, template_json TEXT NOT NULL, template_digest TEXT NOT NULL,
 interval_hours INTEGER NOT NULL CHECK(interval_hours BETWEEN 1 AND 168),
 first_at INTEGER NOT NULL, next_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 max_runs INTEGER NOT NULL CHECK(max_runs BETWEEN 1 AND 30),
 budget_units INTEGER NOT NULL CHECK(budget_units BETWEEN 100 AND 100000),
 per_run_units INTEGER NOT NULL CHECK(per_run_units>0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','blocked','completed','cancelled','expired')),
 version INTEGER NOT NULL DEFAULT 1, approved_by TEXT, approved_at INTEGER,
 error_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 CHECK(max_runs*per_run_units<=budget_units), CHECK(expires_at>first_at)
);
CREATE INDEX agent_routines_due ON agent_routines(status,next_at);
CREATE INDEX agent_routines_space ON agent_routines(workspace_id,updated_at);
CREATE TABLE agent_routine_runs (
 routine_id TEXT NOT NULL REFERENCES agent_routines(id), ordinal INTEGER NOT NULL CHECK(ordinal>0),
 scheduled_at INTEGER NOT NULL, work_id TEXT NOT NULL UNIQUE REFERENCES agent_work(id), created_at INTEGER NOT NULL,
 PRIMARY KEY(routine_id,ordinal), UNIQUE(routine_id,scheduled_at)
);
