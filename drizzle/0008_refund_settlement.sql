-- Records external refunds; this migration never initiates a money transfer.
ALTER TABLE billing_orders ADD COLUMN payment_environment TEXT CHECK(payment_environment IS NULL OR payment_environment IN ('sandbox','live'));
--> statement-breakpoint
ALTER TABLE billing_refunds ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE billing_refund_quotes(
 id TEXT PRIMARY KEY,refund_id TEXT NOT NULL REFERENCES billing_refunds(id),organization_id TEXT NOT NULL,actor TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>0),expected_version INTEGER NOT NULL,plan TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE billing_refund_settlements(
 id TEXT PRIMARY KEY,quote_id TEXT NOT NULL UNIQUE REFERENCES billing_refund_quotes(id),refund_id TEXT NOT NULL REFERENCES billing_refunds(id),
 organization_id TEXT NOT NULL,actor TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),currency TEXT NOT NULL CHECK(currency='XAF'),
 environment TEXT NOT NULL CHECK(environment IN ('sandbox','live')),external_reference TEXT NOT NULL UNIQUE,evidence_note TEXT NOT NULL,created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE billing_credit_notes(
 id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,refund_settlement_id TEXT NOT NULL UNIQUE REFERENCES billing_refund_settlements(id),
 invoice_id TEXT NOT NULL REFERENCES billing_invoices(id),number TEXT NOT NULL UNIQUE,document TEXT NOT NULL,created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER refund_settlement_validate BEFORE INSERT ON billing_refund_settlements BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM billing_refund_quotes q JOIN billing_refunds r ON r.id=q.refund_id JOIN billing_orders o ON o.id=r.order_id
  WHERE q.id=NEW.quote_id AND r.id=NEW.refund_id AND q.actor=NEW.actor AND q.organization_id=NEW.organization_id
   AND q.amount=NEW.amount AND q.expected_version=r.version AND q.expires_at>NEW.created_at
   AND r.status IN ('requested','partially_confirmed') AND o.status IN ('refund_requested','partially_refunded')
   AND o.payment_environment=NEW.environment AND o.currency=NEW.currency AND EXISTS(SELECT 1 FROM billing_invoices i WHERE i.order_id=o.id)
   AND json_extract(o.product,'$.kind')!='upgrade'
   AND NOT EXISTS(SELECT 1 FROM billing_orders u WHERE u.status='fulfilled' AND json_extract(u.product,'$.subscriptionId') IN (SELECT id FROM billing_subscriptions WHERE order_id=o.id))
   AND NEW.amount+COALESCE((SELECT SUM(amount) FROM billing_refund_settlements WHERE refund_id=r.id),0)<=o.amount
 ) THEN RAISE(ABORT,'stale_refund_quote') END;
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM credit_lots l JOIN billing_refunds r ON l.source_id=r.order_id WHERE r.id=NEW.refund_id AND l.organization_id=NEW.organization_id AND l.reserved>0
 ) THEN RAISE(ABORT,'refund_has_reservations') END;
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM json_each((SELECT plan FROM billing_refund_quotes WHERE id=NEW.quote_id),'$.lots') j
  LEFT JOIN credit_lots l ON l.id=json_extract(j.value,'$.id')
  WHERE l.id IS NULL OR l.organization_id!=NEW.organization_id OR l.balance!=json_extract(j.value,'$.balance')
   OR l.reserved!=0 OR l.frozen!=json_extract(j.value,'$.frozen') OR json_extract(j.value,'$.revoke')>l.balance
 ) OR (SELECT COUNT(*) FROM json_each((SELECT plan FROM billing_refund_quotes WHERE id=NEW.quote_id),'$.lots')) != (
  SELECT COUNT(*) FROM credit_lots l JOIN billing_refunds r ON r.order_id=l.source_id WHERE r.id=NEW.refund_id AND l.organization_id=NEW.organization_id
 ) THEN RAISE(ABORT,'refund_credits_changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER refund_settlement_apply AFTER INSERT ON billing_refund_settlements BEGIN
 INSERT INTO credit_ledger(id,organization_id,lot_id,kind,units,reference,created_at)
 SELECT NEW.id||':'||json_extract(value,'$.id'),NEW.organization_id,json_extract(value,'$.id'),'refund',json_extract(value,'$.revoke'),NEW.id,NEW.created_at
 FROM json_each((SELECT plan FROM billing_refund_quotes WHERE id=NEW.quote_id),'$.lots') WHERE json_extract(value,'$.revoke')>0;
 UPDATE credit_lots SET balance=balance-COALESCE((SELECT json_extract(value,'$.revoke') FROM json_each((SELECT plan FROM billing_refund_quotes WHERE id=NEW.quote_id),'$.lots') WHERE json_extract(value,'$.id')=credit_lots.id),0),frozen=0
 WHERE organization_id=NEW.organization_id AND source_id=(SELECT order_id FROM billing_refunds WHERE id=NEW.refund_id);
 UPDATE billing_orders SET status=CASE WHEN (SELECT SUM(amount) FROM billing_refund_settlements WHERE refund_id=NEW.refund_id)=amount THEN 'refunded' ELSE 'partially_refunded' END,updated_at=NEW.created_at
 WHERE id=(SELECT order_id FROM billing_refunds WHERE id=NEW.refund_id);
 UPDATE billing_subscriptions SET status='cancelled',version=version+1
 WHERE order_id=(SELECT order_id FROM billing_refunds WHERE id=NEW.refund_id) AND (SELECT status FROM billing_orders WHERE id=order_id)='refunded';
 UPDATE billing_refunds SET version=version+1,status=CASE WHEN (SELECT status FROM billing_orders WHERE id=order_id)='refunded' THEN 'confirmed' ELSE 'partially_confirmed' END WHERE id=NEW.refund_id;
 INSERT INTO billing_credit_notes(id,organization_id,refund_settlement_id,invoice_id,number,document,created_at)
 SELECT 'credit-note:'||NEW.id,NEW.organization_id,NEW.id,i.id,'AIR-CN-'||NEW.id,
 json_object('invoiceNumber',i.number,'invoiceId',i.id,'originalInvoice',json(i.document),'total',NEW.amount,'currency',NEW.currency,'environment',NEW.environment,'externalReference',NEW.external_reference,'confirmedAt',NEW.created_at,'confirmationSource','administrator_external_evidence'),NEW.created_at
 FROM billing_invoices i JOIN billing_refunds r ON r.order_id=i.order_id WHERE r.id=NEW.refund_id;
 INSERT INTO billing_audit(id,actor,organization_id,action,target,detail,created_at)
 VALUES('refund-confirmed:'||NEW.id,NEW.actor,NEW.organization_id,'refund.externally_confirmed',NEW.refund_id,json_object('settlementId',NEW.id,'amount',NEW.amount,'environment',NEW.environment,'quoteId',NEW.quote_id),NEW.created_at);
 INSERT INTO billing_notifications(id,organization_id,kind,message,created_at)
 VALUES('refund:'||NEW.id,NEW.organization_id,'refund_confirmed','Un remboursement externe a été rapproché. Consultez votre historique de facturation.',NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER refund_settlement_immutable BEFORE UPDATE ON billing_refund_settlements BEGIN SELECT RAISE(ABORT,'immutable_refund'); END;
--> statement-breakpoint
CREATE TRIGGER refund_settlement_no_delete BEFORE DELETE ON billing_refund_settlements BEGIN SELECT RAISE(ABORT,'immutable_refund'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_immutable BEFORE UPDATE ON billing_credit_notes BEGIN SELECT RAISE(ABORT,'immutable_credit_note'); END;
--> statement-breakpoint
CREATE TRIGGER credit_note_no_delete BEFORE DELETE ON billing_credit_notes BEGIN SELECT RAISE(ABORT,'immutable_credit_note'); END;
--> statement-breakpoint
CREATE TRIGGER refund_quote_immutable BEFORE UPDATE ON billing_refund_quotes BEGIN SELECT RAISE(ABORT,'immutable_refund_quote'); END;
