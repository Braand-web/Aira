import { db, getFile, getResource } from './server';
import { draftInput } from './platform-contracts';
import { AppError } from './core.mjs';
const TTL = 7 * 86400000;
export async function getDraft(tenant: string, userId: string, context: string) {
    if (!context || context.length > 160)
        throw new AppError('Contexte de brouillon invalide.');
    const row = await db().prepare('SELECT version,content,attachments,updated_at FROM composer_drafts WHERE workspace_id=? AND user_id=? AND context_id=?').bind(tenant, userId, context).first<{
        version: number;
        content: string;
        attachments: string;
        updated_at: number;
    }>();
    if (row && row.updated_at <= Date.now() - TTL)
        await db().prepare('DELETE FROM composer_drafts WHERE workspace_id=? AND user_id=? AND context_id=? AND updated_at<=?').bind(tenant, userId, context, Date.now() - TTL).run();
    return row && row.updated_at > Date.now() - TTL ? { context, version: row.version, content: row.content, attachments: JSON.parse(row.attachments) as string[], updatedAt: row.updated_at } : { context, version: 0, content: '', attachments: [], updatedAt: 0 };
}
export async function saveDraft(tenant: string, userId: string, input: unknown) {
    const p = draftInput.parse(input);
    if (p.context.startsWith('social:')) {
        const id = p.context.slice(7);
        if (id !== 'new' && !await db().prepare('SELECT id FROM social_posts WHERE id=? AND workspace_id=?').bind(id, tenant).first())
            throw new AppError('Publication introuvable.', 404);
    }
    else if (p.context !== 'new') {
        const resource = await getResource(tenant, p.context);
        if (resource.kind !== 'conversation' || resource.status === 'deleted')
            throw new AppError('Discussion introuvable.', 404);
    }
    for (const id of p.attachments) {
        const file = await getFile(tenant, id);
        if (file.record.status !== 'ready')
            throw new AppError('Une pièce jointe est indisponible.', 409, 'file_not_ready');
    }
    const sql = p.version === 0 ? 'INSERT OR IGNORE INTO composer_drafts(workspace_id,user_id,context_id,content,attachments,updated_at) VALUES (?,?,?,?,?,?)' : 'UPDATE composer_drafts SET content=?,attachments=?,version=version+1,updated_at=? WHERE workspace_id=? AND user_id=? AND context_id=? AND version=?';
    const now = Date.now(), args = p.version === 0 ? [tenant, userId, p.context, p.content, JSON.stringify(p.attachments), now] : [p.content, JSON.stringify(p.attachments), now, tenant, userId, p.context, p.version];
    const result = await db().prepare(sql).bind(...args).run();
    if (!result.meta.changes)
        throw new AppError('Un autre onglet a modifié ce brouillon. Votre saisie reste conservée ; comparez les versions avant de remplacer.', 409, 'draft_conflict');
    return { context: p.context, version: p.version + 1, updatedAt: now };
}
export async function deleteDraft(tenant: string, userId: string, context: string, version: number) { if (!Number.isSafeInteger(version) || version < 1)
    throw new AppError('Version invalide.'); const result = await db().prepare('DELETE FROM composer_drafts WHERE workspace_id=? AND user_id=? AND context_id=? AND version=?').bind(tenant, userId, context, version).run(); if (!result.meta.changes)
    throw new AppError('Le brouillon a changé.', 409, 'draft_conflict'); return { deleted: true }; }
export async function cleanupDrafts() { await db().prepare('DELETE FROM composer_drafts WHERE updated_at<?').bind(Date.now() - TTL).run(); await db().prepare('DELETE FROM research_runs WHERE expires_at<?').bind(Date.now()).run(); await db().prepare('DELETE FROM research_sources WHERE linked_resource_id IS NULL AND expires_at<?').bind(Date.now()).run(); }
