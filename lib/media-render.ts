import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { config, db, uid, createResource, getResource, updateResource, authorize, auditLog } from './server';
import { AppError, safeWebURL } from './core.mjs';
import { digest } from './platform-contracts';
import { reserve, settleHold, type BillingIdentity } from './billing';
import { storeMediaStream } from './media-assets';
import { linkMediaWork, wakeWorkForResource } from './work';
import type { FileRecord } from './contracts';
const q = (sql: string, ...args: (string | number | null)[]) => db().prepare(sql).bind(...args);
export const assemblyInput = z.object({ title: z.string().trim().min(1).max(160), clips: z.array(z.object({ fileId: z.string().min(1).max(160), version: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/), trimStart: z.number().finite().min(0).max(3600), duration: z.number().finite().min(0.1).max(120) }).strict()).min(1).max(10), width: z.number().int().min(256).max(1920), height: z.number().int().min(256).max(1920), captions: z.array(z.object({ text: z.string().min(1).max(300), start: z.number().finite().nonnegative(), end: z.number().finite().positive() }).strict()).max(60), maxCredits: z.number().int().positive().max(1000) }).strict().superRefine((p, c) => { const duration = p.clips.reduce((sum, clip) => sum + clip.duration, 0); if (duration > 180 || p.width % 2 || p.height % 2 || p.width * p.height > 2073600)
    c.addIssue({ code: z.ZodIssueCode.custom, message: 'Limites de durée ou de résolution dépassées.' }); if (p.captions.some(caption => caption.end <= caption.start || caption.end > duration))
    c.addIssue({ code: z.ZodIssueCode.custom, message: 'Les sous-titres doivent tenir dans la vidéo.' }); });
const rateSchema = z.object({ version: z.string().min(1).max(80), credits: z.number().int().positive().max(1000), costCeilingXaf: z.number().finite().positive(), verifiedAt: z.string().datetime(), source: z.string().url() }).strict();
function renderRate() { const rate = rateSchema.parse(JSON.parse(config().MEDIA_RENDER_PRICING_JSON || '{}')); if (Date.now() - Date.parse(rate.verifiedAt) < 0 || Date.now() - Date.parse(rate.verifiedAt) > 86400000 || rate.credits * 4 < rate.costCeilingXaf)
    throw new AppError('Le tarif du montage doit être vérifié.', 503, 'render_price_unverified'); return rate; }
export function renderReadiness() { try {
    renderRate();
    safeWebURL(config().MEDIA_RENDER_URL || '');
    return { ready: config().MEDIA_RENDER_ENABLED === 'true' && config().MEDIA_RENDER_STAGING_VERIFIED === 'true' && !!config().MEDIA_RENDER_TOKEN, reason: config().MEDIA_RENDER_ENABLED !== 'true' ? 'activation_pending' : config().MEDIA_RENDER_STAGING_VERIFIED !== 'true' ? 'verification_pending' : !config().MEDIA_RENDER_TOKEN ? 'connection_missing' : null };
}
catch {
    return { ready: false, reason: 'configuration_pending' };
} }
async function files(tenant: string, clips: z.infer<typeof assemblyInput>['clips']) { let total = 0; const result: FileRecord[] = []; for (const clip of clips) {
    const resource = await getResource(tenant, clip.fileId), file = await q("SELECT * FROM files WHERE id=? AND workspace_id=? AND status='ready'", clip.fileId, tenant).first<FileRecord>();
    if (!file?.storage_key || file.sha256 !== clip.sha256 || resource.version !== clip.version || !file.detected_mime.match(/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/))
        throw new AppError('Un fichier du montage a changé ou n’est pas disponible.', 409, 'render_input_changed');
    total += file.size_bytes;
    result.push(file);
} if (total > 150 * 1024 * 1024)
    throw new AppError('Les sources du montage dépassent 150 Mio.', 413); return result; }
export async function prepareAssembly(who: BillingIdentity, input: unknown) { await authorize(who.tenant, who.user.userId, 'write'); const p = assemblyInput.parse(input); await files(who.tenant, p.clips); if (!renderReadiness().ready)
    throw new AppError('Le service de montage attend sa mise en service. Le storyboard peut être préparé dans un livrable.', 503, 'render_unavailable'); const rate = renderRate(); if (rate.credits > p.maxCredits)
    throw new AppError('Le plafond ne permet pas ce montage.', 402, 'budget_exhausted'); const quote = { input: p, rate, contract: 'braand-render-v1' }, fingerprint = await digest(quote); return createResource(who.tenant, 'proposal', p.title, { kind: 'assembly', title: p.title, rationale: 'Assemblage des fichiers et sous-titres indiqués. Aucune publication.', maxCredits: rate.credits, payload: { ...quote, fingerprint } }, 'awaiting_approval'); }
export async function approveAssembly(who: BillingIdentity, id: string, version: number) {
    await authorize(who.tenant, who.user.userId, 'approve');
    const resource = await getResource(who.tenant, id), old = await q('SELECT id,status FROM media_render_jobs WHERE proposal_id=? AND workspace_id=?', id, who.tenant).first();
    if (old)
        return { operation: old, replayed: true };
    if (resource.version !== version || resource.status !== 'awaiting_approval' || resource.data.kind !== 'assembly')
        throw new AppError('Le montage a changé.', 409, 'stale_version');
    if (!renderReadiness().ready)
        throw new AppError('Le montage est indisponible.', 503, 'render_unavailable');
    const quote = z.object({ input: assemblyInput, rate: rateSchema, contract: z.literal('braand-render-v1'), fingerprint: z.string() }).strict().parse(resource.data.payload), { fingerprint, ...signed } = quote, currentRate = renderRate();
    if (await digest(signed) !== fingerprint || await digest(currentRate) !== await digest(quote.rate))
        throw new AppError('Le tarif ou les paramètres ont changé. Préparez un nouveau devis.', 409, 'render_quote_changed');
    await files(who.tenant, quote.input.clips);
    const hold = await reserve(who, 'assembly:' + id + ':' + version, quote.rate.credits * 100);
    try {
        await linkMediaWork(who.tenant, id, hold.id);
    }
    catch (error) {
        await settleHold(hold.id, 0);
        throw error;
    }
    const jobId = uid(), now = Date.now(), claim = await q('INSERT OR IGNORE INTO media_render_jobs(id,workspace_id,organization_id,actor_id,proposal_id,proposal_version,digest,hold_id,max_units,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', jobId, who.tenant, who.organization, who.user.userId, id, version, fingerprint, hold.id, quote.rate.credits * 100, now, now).run();
    if (!claim.meta.changes)
        return { replayed: true };
    await updateResource(who.tenant, id, version, { status: 'generating' });
    await auditLog(who.tenant, who.user.userId, 'assembly.approved', id, { version, maxCredits: quote.rate.credits });
    return { operationId: jobId, status: 'waiting_external' };
}
async function renderRequest(path: string, init: RequestInit = {}) { const url = new URL(safeWebURL(config().MEDIA_RENDER_URL || '')); url.pathname = url.pathname.replace(/\/$/, '') + path; const headers = new Headers(init.headers); headers.set('Authorization', 'Bearer ' + config().MEDIA_RENDER_TOKEN); const response = await fetch(url.href, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(30000) }); if (!response.ok)
    throw new AppError('Le service de montage doit être vérifié.', 502, 'render_service_failed'); return response; }
type Job = {
    id: string;
    workspace_id: string;
    organization_id: string;
    actor_id: string;
    proposal_id: string;
    proposal_version: number;
    digest: string;
    status: string;
    hold_id: string;
    max_units: number;
    external_id: string | null;
};
export async function runRenderTick() {
    if (!renderReadiness().ready)
        return { disabled: true };
    const now = Date.now();
    await q("UPDATE media_render_jobs SET status='uncertain',error_code='render_submission_interrupted' WHERE status='submitting' AND lease_until<=?", now).run();
    const jobs = await q("SELECT * FROM media_render_jobs WHERE status IN ('queued','waiting_external') AND lease_until<=? ORDER BY created_at LIMIT 3", now).all<Job>();
    for (const job of jobs.results) {
        const token = uid(), claim = await q('UPDATE media_render_jobs SET lease_token=?,lease_until=? WHERE id=? AND status=? AND lease_until<=?', token, Date.now() + 120000, job.id, job.status, now).run();
        if (!claim.meta.changes)
            continue;
        try {
            const rights = await authorize(job.workspace_id, job.actor_id, 'approve'), who: BillingIdentity = { tenant: job.workspace_id, organization: job.organization_id, role: rights.role, user: { userId: job.actor_id, email: '', displayName: '' } }, proposal = await getResource(job.workspace_id, job.proposal_id);
            if (job.status === 'queued') {
                const quote = z.object({ input: assemblyInput, rate: rateSchema, contract: z.string(), fingerprint: z.string() }).parse(proposal.data.payload);
                if (quote.fingerprint !== job.digest)
                    throw new AppError('Le montage a changé.', 409, 'render_quote_changed');
                const sources = await files(job.workspace_id, quote.input.clips);
                await q("UPDATE media_render_jobs SET status='submitting' WHERE id=? AND lease_token=?", job.id, token).run();
                const created = await renderRequest('/v1/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: job.id, ...quote.input }) });
                const native = z.object({ id: z.string().uuid() }).parse(await created.json());
                if (native.id !== job.id)
                    throw new AppError('Le service a changé la référence du montage.', 502);
                for (const file of sources) {
                    const content = await env.BUCKET?.get(file.storage_key!);
                    if (!content)
                        throw new AppError('Une source du montage est indisponible.', 404);
                    await renderRequest('/v1/jobs/' + job.id + '/inputs/' + file.id, { method: 'PUT', headers: { 'Content-Type': file.detected_mime, 'Content-Length': String(file.size_bytes), 'X-Content-SHA256': file.sha256! }, body: content.body });
                }
                await renderRequest('/v1/jobs/' + job.id + '/run', { method: 'POST' });
                await q("UPDATE media_render_jobs SET status='waiting_external',external_id=?,updated_at=? WHERE id=? AND lease_token=?", job.id, Date.now(), job.id, token).run();
                continue;
            }
            const state = z.object({ id: z.string().uuid(), status: z.enum(['draft', 'running', 'completed', 'failed']), processingMs: z.number().finite().nonnegative().optional(), outputSha256: z.string().optional() }).passthrough().parse(await (await renderRequest('/v1/jobs/' + job.id)).json());
            if (state.id !== job.id)
                throw new AppError('Le résultat du montage a changé.', 502);
            if (state.status === 'running' || state.status === 'draft')
                continue;
            if (state.status === 'failed') {
                await settleHold(job.hold_id, state.processingMs ? job.max_units : 0);
                await q("UPDATE media_render_jobs SET status='failed',error_code='render_failed' WHERE id=?", job.id).run();
                await updateResource(job.workspace_id, proposal.id, proposal.version, { status: 'failed' });
                continue;
            }
            const output = await renderRequest('/v1/jobs/' + job.id + '/output'), file = await storeMediaStream(who, output, proposal.title + '.mp4');
            if (state.outputSha256 !== file.sha256)
                throw new AppError('L’empreinte du montage ne correspond pas.', 502, 'render_output_changed');
            const mediaId = 'assembly:' + job.id, at = Date.now();
            await db().batch([q("INSERT OR IGNORE INTO resources(id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,'media',?,?,'ready',?,?)", mediaId, who.tenant, proposal.title, JSON.stringify({ output: { video: { url: '/api/files?id=' + file.fileId } }, proposalId: proposal.id, storageStatus: 'stored', assembly: { processingMs: state.processingMs, semanticReview: 'not_performed' } }), at, at), q('INSERT OR IGNORE INTO media_assets(id,workspace_id,resource_id,file_id,resource_version,position,digest,metadata,created_at) VALUES (?,?,?,?,1,0,?,?,?)', 'asset:' + mediaId, who.tenant, mediaId, file.fileId, file.sha256, JSON.stringify({ mime: file.mime, size: file.size }), at)]);
            await settleHold(job.hold_id, job.max_units);
            await q("UPDATE media_render_jobs SET status='completed',result=?,updated_at=? WHERE id=?", JSON.stringify({ resourceId: mediaId }), Date.now(), job.id).run();
            await updateResource(job.workspace_id, proposal.id, proposal.version, { status: 'completed' });
            await wakeWorkForResource(job.workspace_id, proposal.id);
        }
        catch (error) {
            await q("UPDATE media_render_jobs SET status='uncertain',error_code=?,updated_at=? WHERE id=?", error instanceof AppError ? error.code : 'render_failed', Date.now(), job.id).run();
        }
        finally {
            await q('UPDATE media_render_jobs SET lease_token=NULL,lease_until=? WHERE id=? AND lease_token=?', Date.now() + 60000, job.id, token).run();
        }
    }
    return { checked: jobs.results.length };
}
export async function assemblyState(tenant: string, proposalId: string) { const row = await q('SELECT status,result FROM media_render_jobs WHERE proposal_id=? AND workspace_id=?', proposalId, tenant).first<{
    status: string;
    result: string | null;
}>(); return row ? row.status === 'completed' ? { status: 'COMPLETED', ...JSON.parse(row.result || '{}') } : { status: row.status } : { status: 'awaiting_approval' }; }
