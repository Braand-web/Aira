-- Quotas are enforced transactionally, including calls from model tools.
CREATE TRIGGER project_quota BEFORE INSERT ON resources WHEN NEW.kind='project' BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM resources r JOIN workspaces w ON w.id=r.workspace_id WHERE w.organization_id=(SELECT organization_id FROM workspaces WHERE id=NEW.workspace_id) AND r.kind='project' AND r.status NOT IN ('archived','cancelled')) >= COALESCE((SELECT CASE plan WHEN 'business' THEN 50 ELSE 10 END FROM billing_subscriptions WHERE organization_id=(SELECT organization_id FROM workspaces WHERE id=NEW.workspace_id) AND status='active' AND start_at<=NEW.created_at AND end_at>NEW.created_at ORDER BY start_at DESC LIMIT 1),2) THEN RAISE(ABORT,'project_quota') END;
END;
--> statement-breakpoint
CREATE TRIGGER run_concurrency BEFORE INSERT ON runs WHEN NEW.status='streaming' BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM runs r JOIN workspaces w ON w.id=r.workspace_id WHERE w.organization_id=(SELECT organization_id FROM workspaces WHERE id=NEW.workspace_id) AND r.status='streaming') >= COALESCE((SELECT CASE plan WHEN 'business' THEN 3 ELSE 1 END FROM billing_subscriptions WHERE organization_id=(SELECT organization_id FROM workspaces WHERE id=NEW.workspace_id) AND status='active' AND start_at<=NEW.created_at AND end_at>NEW.created_at ORDER BY start_at DESC LIMIT 1),1) THEN RAISE(ABORT,'concurrency_limit') END;
END;
--> statement-breakpoint
CREATE TRIGGER storage_quota BEFORE INSERT ON billing_meter WHEN NEW.kind='storage' AND NEW.quantity>0 AND NEW.id NOT LIKE 'opening-storage:%' BEGIN
 SELECT CASE WHEN NEW.quantity+COALESCE((SELECT SUM(quantity) FROM billing_meter WHERE organization_id=NEW.organization_id AND kind='storage'),0)>COALESCE((SELECT CASE plan WHEN 'business' THEN 10737418240 ELSE 2147483648 END FROM billing_subscriptions WHERE organization_id=NEW.organization_id AND status='active' AND start_at<=NEW.created_at AND end_at>NEW.created_at ORDER BY start_at DESC LIMIT 1),268435456) THEN RAISE(ABORT,'storage_quota') END;
END;
--> statement-breakpoint
CREATE TRIGGER transfer_quota BEFORE INSERT ON billing_meter WHEN NEW.kind='transfer' AND NEW.quantity>0 BEGIN
 SELECT CASE WHEN NEW.quantity+COALESCE((SELECT SUM(quantity) FROM billing_meter WHERE organization_id=NEW.organization_id AND kind='transfer' AND created_at>=NEW.created_at-2592000000),0)>COALESCE((SELECT CASE plan WHEN 'business' THEN 53687091200 ELSE 10737418240 END FROM billing_subscriptions WHERE organization_id=NEW.organization_id AND status='active' AND start_at<=NEW.created_at AND end_at>NEW.created_at ORDER BY start_at DESC LIMIT 1),1073741824) THEN RAISE(ABORT,'transfer_quota') END;
END;
--> statement-breakpoint
INSERT INTO billing_meter SELECT 'opening-storage:'||r.id,w.organization_id,'storage',COALESCE(json_extract(r.data,'$.size'),0),r.created_at FROM resources r JOIN workspaces w ON w.id=r.workspace_id WHERE r.kind='file';
--> statement-breakpoint
CREATE TABLE billing_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,organization_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TRIGGER billing_audit_immutable BEFORE UPDATE ON billing_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
--> statement-breakpoint
CREATE TRIGGER billing_audit_no_delete BEFORE DELETE ON billing_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
