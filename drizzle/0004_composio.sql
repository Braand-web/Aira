CREATE TABLE `connector_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`result` text,
	`log_id` text,
	`hold_id` text,
	`max_micros` integer DEFAULT 0 NOT NULL,
	`actual_micros` integer,
	`month` text NOT NULL,
	`user_limit` integer NOT NULL,
	`org_limit` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `connector_budget` ON `connector_actions` (`organization_id`,`month`,`status`);--> statement-breakpoint
CREATE TABLE `connector_sessions` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`session_id` text NOT NULL,
	`scope_user` text NOT NULL,
	`mode` text DEFAULT 'connected' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`, `conversation_id`, `mode`)
);
--> statement-breakpoint
-- Protect shared dollar budgets under concurrent approvals.
CREATE TRIGGER connector_budget_guard BEFORE UPDATE OF status ON connector_actions
 WHEN NEW.status='executing' AND OLD.status='pending' AND NEW.max_micros>0 BEGIN
 SELECT CASE WHEN NEW.max_micros+COALESCE((SELECT SUM(COALESCE(actual_micros,max_micros)) FROM connector_actions WHERE organization_id=NEW.organization_id AND month=NEW.month AND status IN ('executing','completed','failed','uncertain') AND id!=NEW.id),0)>NEW.org_limit THEN RAISE(ABORT,'instant_budget') END;
 SELECT CASE WHEN NEW.max_micros+COALESCE((SELECT SUM(COALESCE(actual_micros,max_micros)) FROM connector_actions WHERE organization_id=NEW.organization_id AND user_id=NEW.user_id AND month=NEW.month AND status IN ('executing','completed','failed','uncertain') AND id!=NEW.id),0)>NEW.user_limit THEN RAISE(ABORT,'instant_budget') END;
END;
