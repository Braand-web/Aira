-- Add the commercial tier without rebuilding legacy subscriptions or their CHECK.
-- plan remains the capacity class consumed by the existing database quota guards;
-- Essentiel shares the single-user Pro capacities, but not its feature permissions.
ALTER TABLE billing_subscriptions ADD COLUMN catalog_plan TEXT CHECK(catalog_plan IS NULL OR catalog_plan IN ('essential','pro','business'));
--> statement-breakpoint
ALTER TABLE billing_subscriptions ADD COLUMN credit_allowance INTEGER CHECK(credit_allowance IS NULL OR credit_allowance>=0);
--> statement-breakpoint
ALTER TABLE billing_subscriptions ADD COLUMN catalog_version TEXT;
--> statement-breakpoint
ALTER TABLE billing_subscriptions ADD COLUMN contract_price INTEGER CHECK(contract_price IS NULL OR contract_price>0);
--> statement-breakpoint
-- Preserve immutable legacy credit-note documents; tax allocations are append-only.
CREATE TABLE billing_credit_note_taxes(credit_note_id TEXT PRIMARY KEY REFERENCES billing_credit_notes(id),subtotal INTEGER NOT NULL CHECK(subtotal>=0),tax INTEGER NOT NULL CHECK(tax>=0));
--> statement-breakpoint
CREATE TRIGGER credit_note_tax_snapshot AFTER INSERT ON billing_credit_notes BEGIN
 INSERT INTO billing_credit_note_taxes(credit_note_id,subtotal,tax)
 SELECT NEW.id,json_extract(q.plan,'$.subtotal'),json_extract(q.plan,'$.tax')
 FROM billing_refund_settlements s JOIN billing_refund_quotes q ON q.id=s.quote_id
 WHERE s.id=NEW.refund_settlement_id AND json_type(q.plan,'$.tax')='integer' AND json_type(q.plan,'$.subtotal')='integer';
END;
--> statement-breakpoint
CREATE TRIGGER credit_note_tax_immutable BEFORE UPDATE ON billing_credit_note_taxes BEGIN SELECT RAISE(ABORT,'immutable_credit_note_tax'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_tax_no_delete BEFORE DELETE ON billing_credit_note_taxes BEGIN SELECT RAISE(ABORT,'immutable_credit_note_tax'); END;
