import { db, uid } from './server';
import { AppError } from './core.mjs';
import { requestCostUnits } from './llm';
import { usageUnits } from './billing-core.mjs';
import { modelRateSchema, type ModelCostRow } from './model-protocol';
import type { RunBudget } from './metering';
export async function toolUsage(holdId: string) { const rows = await db().prepare('SELECT status,ceiling_units,actual_units FROM agent_tool_usage WHERE hold_id=?').bind(holdId).all<{
    status: string;
    ceiling_units: number;
    actual_units: number | null;
}>(); return { count: rows.results.length, units: rows.results.reduce((sum, r) => sum + (r.status === 'complete' ? r.actual_units || 0 : 0), 0), reserved: rows.results.reduce((sum, r) => sum + (['pending', 'unknown'].includes(r.status) ? r.ceiling_units : 0), 0), unresolved: rows.results.some(r => ['pending', 'unknown'].includes(r.status)) }; }
export async function claimToolUsage(budget: RunBudget, provider: string, operation: string, ceiling: number, rate: unknown) {
    await budget.beforeTool?.();
    if (!Number.isSafeInteger(ceiling) || ceiling < 0)
        throw new AppError('Plafond d’outil invalide.');
    const used = await db().prepare('SELECT usage,status,provider,cost_xaf,rate FROM provider_usage WHERE hold_id=?').bind(budget.holdId).all<ModelCostRow>(), tools = await toolUsage(budget.holdId);
    if (tools.unresolved || used.results.some(row => ['pending', 'unknown'].includes(row.status)))
        throw new AppError('Un coût attend un rapprochement.', 409, 'tool_usage_unknown');
    const browser = await (await import('./browser')).browserUsageUnits(budget.holdId);
    if (browser.unresolved)
        throw new AppError('Un coût de navigation attend un rapprochement.', 409, 'tool_usage_unknown');
    const consumed = used.results.reduce((sum, row) => sum + (['complete', 'estimated'].includes(row.status) ? requestCostUnits(row, row.rate ? modelRateSchema.parse(JSON.parse(row.rate)) : budget.rate, usageUnits) : 0), 0);
    if (consumed + tools.units + browser.units + browser.reservedUnits + ceiling > budget.limit)
        throw new AppError('Le plafond de cette demande ne permet pas cet outil. Les résultats sont conservés.', 402, 'budget_exhausted');
    const id = uid(), claimed = await db().prepare("INSERT INTO agent_tool_usage(id,workspace_id,run_id,hold_id,provider,operation,status,ceiling_units,rate,created_at) SELECT ?,?,?,?,?,?,'pending',?,?,? WHERE NOT EXISTS(SELECT 1 FROM agent_tool_usage WHERE hold_id=? AND status IN ('pending','unknown')) AND NOT EXISTS(SELECT 1 FROM provider_usage WHERE hold_id=? AND status IN ('pending','unknown')) AND (SELECT COUNT(*) FROM provider_usage WHERE hold_id=?)=? AND (SELECT COUNT(*) FROM agent_tool_usage WHERE hold_id=?)=?").bind(id, budget.who.tenant, budget.runId, budget.holdId, provider, operation, ceiling, JSON.stringify(rate), Date.now(), budget.holdId, budget.holdId, budget.holdId, used.results.length, budget.holdId, tools.count).run();
    if (!claimed.meta.changes)
        throw new AppError('Le budget est utilisé par un autre outil. Aucun nouvel appel.', 409, 'tool_budget_busy');
    return id;
}
export async function confirmToolUsage(id: string, units: number, receiptId?: string) { const row = await db().prepare('SELECT ceiling_units FROM agent_tool_usage WHERE id=?').bind(id).first<{
    ceiling_units: number;
}>(); if (!row || !Number.isSafeInteger(units) || units < 0 || units > row.ceiling_units) {
    await unknownToolUsage(id);
    throw new AppError('Le coût réel de l’outil doit être rapproché.', 409, 'tool_usage_unknown');
} await db().prepare("UPDATE agent_tool_usage SET status='complete',actual_units=?,receipt_id=? WHERE id=? AND status='pending'").bind(units, receiptId?.slice(0, 200) || null, id).run(); }
export async function unknownToolUsage(id: string) { await db().prepare("UPDATE agent_tool_usage SET status='unknown' WHERE id=? AND status='pending'").bind(id).run(); }
export async function rejectToolUsage(id: string) { await db().prepare("UPDATE agent_tool_usage SET status='rejected',actual_units=0 WHERE id=? AND status='pending'").bind(id).run(); }
