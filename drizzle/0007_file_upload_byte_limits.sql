-- Track upload bytes as well as session starts so multipart retries cannot
-- bypass the per-user transfer limit. Existing rows start at zero bytes.
ALTER TABLE `file_upload_limits` ADD COLUMN `bytes` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `file_upload_part_limits` (
  `user_id` text NOT NULL,
  `window_start` integer NOT NULL,
  `count` integer NOT NULL DEFAULT 0,
  `bytes` integer NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`,`window_start`)
);
