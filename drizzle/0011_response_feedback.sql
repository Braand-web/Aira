-- Existing messages stay unlinked: no guessed run or completion status.
ALTER TABLE messages ADD COLUMN run_id TEXT REFERENCES runs(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX message_run ON messages(workspace_id,run_id);
--> statement-breakpoint
CREATE UNIQUE INDEX message_workspace_identity ON messages(id,workspace_id);
--> statement-breakpoint
CREATE TABLE response_feedback (
 workspace_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 message_id TEXT NOT NULL,
 feedback TEXT CHECK(feedback IN ('up','down') OR feedback IS NULL),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(workspace_id,user_id,message_id),
 FOREIGN KEY(message_id,workspace_id) REFERENCES messages(id,workspace_id) ON DELETE CASCADE
);
