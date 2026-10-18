ALTER TABLE billing_orders ADD COLUMN next_reconcile_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE billing_orders ADD COLUMN reconcile_lease_until INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE billing_orders ADD COLUMN reconcile_attempts INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX billing_orders_reconcile ON billing_orders(status,next_reconcile_at,reconcile_lease_until,created_at);
