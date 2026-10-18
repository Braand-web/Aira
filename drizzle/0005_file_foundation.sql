-- Additive file metadata foundation. Legacy resources remain untouched so rollback is safe.
CREATE TABLE IF NOT EXISTS `files` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `owner_id` text,
  `legacy_resource_id` text,
  `display_name` text NOT NULL,
  `storage_name` text NOT NULL,
  `size_bytes` integer NOT NULL DEFAULT 0,
  `detected_mime` text NOT NULL DEFAULT 'application/octet-stream',
  `sha256` text,
  `status` text NOT NULL DEFAULT 'uploading' CHECK (`status` IN ('uploading','validating','ready','rejected','deleted')),
  `storage_key` text,
  `thumbnail_key` text,
  `extraction_key` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `file_legacy_resource` ON `files` (`legacy_resource_id`) WHERE `legacy_resource_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `file_workspace_sha256` ON `files` (`workspace_id`,`sha256`) WHERE `sha256` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `file_workspace_status` ON `files` (`workspace_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `file_deleted_at` ON `files` (`status`,`deleted_at`);
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `attachments` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
INSERT OR IGNORE INTO `files` (
  `id`,`workspace_id`,`owner_id`,`legacy_resource_id`,`display_name`,`storage_name`,`size_bytes`,
  `detected_mime`,`sha256`,`status`,`storage_key`,`created_at`,`updated_at`,`deleted_at`
)
SELECT r.id,r.workspace_id,o.owner_id,r.id,r.title,r.title,
  COALESCE(CAST(json_extract(r.data,'$.size') AS INTEGER),0),
  COALESCE(json_extract(r.data,'$.mime'),'application/octet-stream'),NULL,
  CASE WHEN r.status='deleted' THEN 'deleted' ELSE 'ready' END,
  json_extract(r.data,'$.key'),r.created_at,r.updated_at,
  CASE WHEN r.status='deleted' THEN r.updated_at ELSE NULL END
FROM resources r
LEFT JOIN workspaces w ON w.id=r.workspace_id
LEFT JOIN organizations o ON o.id=w.organization_id
WHERE r.kind='file';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `file_upload_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `actor_id` text,
  `file_id` text,
  `action` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `file_audit_workspace_created` ON `file_upload_audit` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `file_upload_limits` (
  `user_id` text NOT NULL,
  `window_start` integer NOT NULL,
  `count` integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `file_upload_limits_user_window` ON `file_upload_limits` (`user_id`,`window_start`);
