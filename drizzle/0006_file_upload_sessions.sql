-- Durable metadata for resumable R2 multipart uploads. Incomplete sessions are
-- cleaned after their expiry; completed files remain governed by file retention.
CREATE TABLE IF NOT EXISTS `file_upload_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `owner_id` text NOT NULL,
  `file_id` text NOT NULL,
  `multipart_upload_id` text NOT NULL,
  `storage_key` text NOT NULL,
  `display_name` text NOT NULL,
  `storage_name` text NOT NULL,
  `declared_size` integer NOT NULL,
  `declared_mime` text NOT NULL DEFAULT '',
  `sha256` text NOT NULL,
  `part_size` integer NOT NULL,
  `part_count` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'uploading' CHECK (`status` IN ('uploading','validating','completed','aborted','failed')),
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `file_upload_session_file` ON `file_upload_sessions` (`file_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `file_upload_session_expiry` ON `file_upload_sessions` (`status`,`expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `file_upload_session_owner` ON `file_upload_sessions` (`workspace_id`,`owner_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `file_upload_parts` (
  `upload_id` text NOT NULL,
  `part_number` integer NOT NULL,
  `etag` text NOT NULL,
  `sha256` text NOT NULL,
  `size_bytes` integer NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`upload_id`,`part_number`),
  FOREIGN KEY (`upload_id`) REFERENCES `file_upload_sessions`(`id`) ON UPDATE no action ON DELETE CASCADE
);
