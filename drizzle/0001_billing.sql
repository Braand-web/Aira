CREATE TABLE organizations(id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
ALTER TABLE workspaces ADD COLUMN organization_id TEXT REFERENCES organizations(id);
--> statement-breakpoint
INSERT INTO organizations SELECT id,name,id,created_at FROM workspaces;
--> statement-breakpoint
UPDATE workspaces SET organization_id=id;
--> statement-breakpoint
CREATE TABLE organization_members(organization_id TEXT NOT NULL REFERENCES organizations(id),user_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','admin','editor','approver','reader')),active INTEGER NOT NULL DEFAULT 1,spend_limit INTEGER, PRIMARY KEY(organization_id,user_id));
--> statement-breakpoint
INSERT INTO organization_members SELECT id,id,'owner',1,NULL FROM organizations;
--> statement-breakpoint
CREATE TABLE billing_quotes(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,actor TEXT NOT NULL,product TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),version TEXT NOT NULL,subscription_version TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE billing_orders(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,quote_id TEXT NOT NULL UNIQUE,actor TEXT NOT NULL,idempotency_key TEXT NOT NULL,status TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'XAF',product TEXT NOT NULL,session_id TEXT UNIQUE,checkout_url TEXT,transaction_id TEXT UNIQUE,verified TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(organization_id,idempotency_key));
--> statement-breakpoint
CREATE TABLE billing_subscriptions(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,plan TEXT NOT NULL CHECK(plan IN ('pro','business')),cycle TEXT NOT NULL CHECK(cycle IN ('period','annual')),start_at INTEGER NOT NULL,end_at INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'active',order_id TEXT NOT NULL UNIQUE);
--> statement-breakpoint
CREATE INDEX billing_subscriptions_org ON billing_subscriptions(organization_id,start_at,end_at);
--> statement-breakpoint
CREATE TABLE credit_lots(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,source TEXT NOT NULL,source_id TEXT NOT NULL,granted INTEGER NOT NULL CHECK(granted>=0),balance INTEGER NOT NULL CHECK(balance>=0),reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=balance),starts_at INTEGER NOT NULL,expires_at INTEGER,frozen INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX credit_lots_org ON credit_lots(organization_id,expires_at);
--> statement-breakpoint
CREATE TABLE credit_ledger(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,lot_id TEXT NOT NULL REFERENCES credit_lots(id),kind TEXT NOT NULL,units INTEGER NOT NULL,reference TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TRIGGER ledger_immutable BEFORE UPDATE ON credit_ledger BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON credit_ledger BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER lot_grant AFTER INSERT ON credit_lots BEGIN INSERT INTO credit_ledger VALUES('grant:'||NEW.id,NEW.organization_id,NEW.id,'grant',NEW.granted,NEW.source_id,NEW.created_at); END;
--> statement-breakpoint
CREATE TABLE credit_holds(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,workspace_id TEXT NOT NULL,actor TEXT NOT NULL,reference TEXT NOT NULL UNIQUE,units INTEGER NOT NULL CHECK(units>0),actual INTEGER,status TEXT NOT NULL DEFAULT 'reserved',created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE credit_allocations(id TEXT PRIMARY KEY,hold_id TEXT NOT NULL REFERENCES credit_holds(id),lot_id TEXT NOT NULL REFERENCES credit_lots(id),units INTEGER NOT NULL CHECK(units>0),charged INTEGER NOT NULL DEFAULT 0 CHECK(charged>=0 AND charged<=units),state TEXT NOT NULL DEFAULT 'reserved',created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TRIGGER allocation_reserve BEFORE INSERT ON credit_allocations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM credit_lots l JOIN credit_holds h ON h.id=NEW.hold_id WHERE l.id=NEW.lot_id AND l.organization_id=h.organization_id AND l.frozen=0 AND l.starts_at<=NEW.created_at AND (l.expires_at IS NULL OR l.expires_at>NEW.created_at) AND l.balance-l.reserved>=NEW.units) THEN RAISE(ABORT,'insufficient_credits') END;
END;
--> statement-breakpoint
CREATE TRIGGER allocation_reserved AFTER INSERT ON credit_allocations BEGIN
 UPDATE credit_lots SET reserved=reserved+NEW.units WHERE id=NEW.lot_id;
 INSERT INTO credit_ledger SELECT 'reserve:'||NEW.id,organization_id,NEW.lot_id,'reserve',NEW.units,NEW.hold_id,NEW.created_at FROM credit_lots WHERE id=NEW.lot_id;
END;
--> statement-breakpoint
CREATE TRIGGER allocation_final BEFORE UPDATE ON credit_allocations WHEN OLD.state!='reserved' BEGIN SELECT RAISE(ABORT,'allocation_final'); END;
--> statement-breakpoint
CREATE TRIGGER allocation_settle AFTER UPDATE OF state ON credit_allocations WHEN NEW.state='settled' AND OLD.state='reserved' BEGIN
 UPDATE credit_lots SET reserved=reserved-OLD.units,balance=balance-NEW.charged WHERE id=NEW.lot_id;
 INSERT INTO credit_ledger SELECT 'consume:'||NEW.id,organization_id,NEW.lot_id,'consume',NEW.charged,NEW.hold_id,NEW.created_at FROM credit_lots WHERE id=NEW.lot_id;
 INSERT INTO credit_ledger SELECT 'release:'||NEW.id,organization_id,NEW.lot_id,'release',OLD.units-NEW.charged,NEW.hold_id,NEW.created_at FROM credit_lots WHERE id=NEW.lot_id;
END;
--> statement-breakpoint
CREATE TABLE billing_events(id TEXT PRIMARY KEY,event_type TEXT NOT NULL,transaction_id TEXT,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,error TEXT,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE billing_invoices(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,order_id TEXT NOT NULL UNIQUE,number TEXT NOT NULL UNIQUE,document TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TRIGGER invoice_immutable BEFORE UPDATE ON billing_invoices BEGIN SELECT RAISE(ABORT,'immutable_invoice'); END;
--> statement-breakpoint
CREATE TABLE billing_refunds(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,order_id TEXT NOT NULL,reason TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'requested',external_reference TEXT UNIQUE,created_at INTEGER NOT NULL,UNIQUE(order_id,status));
--> statement-breakpoint
CREATE TABLE provider_usage(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,workspace_id TEXT NOT NULL,run_id TEXT NOT NULL,hold_id TEXT NOT NULL,provider TEXT NOT NULL,role TEXT NOT NULL,request_id TEXT,rate TEXT NOT NULL,usage TEXT,cost_xaf REAL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE billing_notifications(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL,read_at INTEGER);
--> statement-breakpoint
CREATE TABLE billing_invites(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL,spaces TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending',expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE billing_limits(organization_id TEXT NOT NULL,scope TEXT NOT NULL,scope_id TEXT NOT NULL,units INTEGER NOT NULL CHECK(units>=0),PRIMARY KEY(organization_id,scope,scope_id));
--> statement-breakpoint
CREATE TABLE billing_claims(user_id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,day TEXT NOT NULL,units INTEGER NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE billing_meter(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,kind TEXT NOT NULL,quantity INTEGER NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX billing_one_open_order ON billing_orders(organization_id) WHERE status IN ('initializing','pending','verified','needs_reconciliation');
--> statement-breakpoint
CREATE TRIGGER hold_budget BEFORE INSERT ON credit_holds BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM billing_limits l WHERE l.organization_id=NEW.organization_id AND (l.scope='organization' OR (l.scope='workspace' AND l.scope_id=NEW.workspace_id) OR (l.scope='member' AND l.scope_id=NEW.actor)) AND l.units<NEW.units+COALESCE((SELECT SUM(CASE WHEN h.status='settled' THEN h.actual ELSE h.units END) FROM credit_holds h WHERE h.organization_id=NEW.organization_id AND h.created_at>=NEW.created_at-2592000000 AND (l.scope='organization' OR (l.scope='workspace' AND h.workspace_id=NEW.workspace_id) OR (l.scope='member' AND h.actor=NEW.actor))),0)) THEN RAISE(ABORT,'spend_limit') END;
END;
--> statement-breakpoint
INSERT INTO credit_lots SELECT 'opening:'||id,id,'opening',id,credits*100,credits*100,0,created_at,NULL,0,created_at FROM workspaces WHERE credits>0;
--> statement-breakpoint
INSERT INTO credit_holds SELECT 'legacy:'||id,workspace_id,workspace_id,workspace_id,'legacy:'||id,amount*100,NULL,'reserved',created_at FROM operations WHERE status IN ('submitting','waiting_external','settling','needs_reconciliation');
--> statement-breakpoint
INSERT INTO credit_allocations SELECT 'legacy:'||id,'legacy:'||id,'opening:'||workspace_id,amount*100,0,'reserved',created_at FROM operations WHERE status IN ('submitting','waiting_external','settling','needs_reconciliation');
