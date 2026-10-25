import { z } from 'zod';
import { config } from './server';
import { AppError } from './core.mjs';
import { NETWORKS, digest, type SocialNetwork } from './platform-contracts';
const path = z.string().regex(/^[a-zA-Z0-9_.]{1,160}$/), slug = z.string().regex(/^[A-Z][A-Z0-9_]{0,199}$/).refine(value => !value.startsWith('COMPOSIO_'));
const call = z.object({ toolSlug: slug, arguments: z.record(z.unknown()) }).strict();
const read = call.extend({ itemsPath: path, idPath: path, textPath: path.optional(), authorPath: path.optional(), postPath: path.optional(), parentPath: path.optional(), publishedPath: path.optional(), metricsPath: path.optional() });
export const socialAdapterSchema = z.object({ network: z.enum(NETWORKS), toolkit: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/), version: z.string().min(1).max(80), verifiedAt: z.string().datetime(), source: z.string().url(), enabled: z.boolean(),
    discovery: call.extend({ itemsPath: path, idPath: path, labelPath: path, capabilityPaths: z.object({ publish: path.optional(), comments: path.optional(), insights: path.optional() }).strict() }),
    formats: z.array(z.enum(['text', 'image', 'carousel', 'video', 'story'])).min(1).max(5),
    publish: z.object({ steps: z.array(call.extend({ idPath: path.optional() })).min(1).max(8), idPath: path, urlPath: path.optional(), statusPath: path.optional(), publishedValues: z.array(z.string()).min(1).max(10), processingValues: z.array(z.string()).max(10).default([]) }).strict(),
    poll: call.extend({ idPath: path, urlPath: path.optional(), statusPath: path, publishedValues: z.array(z.string()).min(1).max(10), failedValues: z.array(z.string()).max(10).default([]) }).optional(),
    comments: read.optional(), reply: call.extend({ idPath: path }).optional(), insights: read.optional(),
    limits: z.object({ textChars: z.number().int().positive().max(12000), maxAssets: z.number().int().min(0).max(10) }).strict()
}).strict();
export type SocialAdapter = z.infer<typeof socialAdapterSchema>;
export function adapters() { try {
    return z.array(socialAdapterSchema).max(4).parse(JSON.parse(config().SOCIAL_ADAPTERS_JSON || '[]'));
}
catch {
    throw new AppError('Les capacités sociales attendent une vérification.', 503, 'social_adapter_invalid');
} }
export function socialReadiness(network?: SocialNetwork) { let list: SocialAdapter[] = []; try {
    list = adapters();
}
catch {
    return { ready: false, reason: 'verification_pending' };
} const c = config(), matched = list.filter(item => (!network || item.network === network) && item.enabled && Date.now() - Date.parse(item.verifiedAt) >= 0 && Date.now() - Date.parse(item.verifiedAt) < 30 * 86400000); return { ready: c.SOCIAL_ENABLED === 'true' && c.SOCIAL_STAGING_VERIFIED === 'true' && !!c.COMPOSIO_API_KEY && matched.length > 0 && (!network || c['SOCIAL_' + network.toUpperCase() + '_ENABLED'] === 'true'), reason: c.SOCIAL_ENABLED !== 'true' ? 'activation_pending' : c.SOCIAL_STAGING_VERIFIED !== 'true' ? 'verification_pending' : !c.COMPOSIO_API_KEY ? 'connection_missing' : !matched.length ? 'adapter_pending' : network && c['SOCIAL_' + network.toUpperCase() + '_ENABLED'] !== 'true' ? 'network_pending' : null }; }
export function adapter(network: SocialNetwork) { const item = adapters().find(item => item.network === network && item.enabled); if (!item || Date.now() - Date.parse(item.verifiedAt) < 0 || Date.now() - Date.parse(item.verifiedAt) > 30 * 86400000)
    throw new AppError('Cette capacité sociale doit être vérifiée avant utilisation.', 503, 'social_adapter_unverified'); return item; }
export function at(value: unknown, pathValue: string | undefined): unknown { if (!pathValue)
    return undefined; let item = value; for (const key of pathValue.split('.')) {
    if (!item || typeof item !== 'object' || ['__proto__', 'constructor', 'prototype'].includes(key))
        return undefined;
    item = (item as Record<string, unknown>)[key];
} return item; }
/** Reviewed server templates only. A model never supplies tool slugs, paths or templates. */
export function argumentsFor(template: Record<string, unknown>, context: Record<string, unknown>) { const visit = (value: unknown, depth = 0): unknown => { if (depth > 15)
    throw new AppError('Paramètres sociaux trop imbriqués.'); if (typeof value === 'string' && value.startsWith('$')) {
    const result = at(context, value.slice(1));
    if (result === undefined)
        throw new AppError('Une dépendance de publication manque.', 409, 'social_dependency_missing');
    return result;
} if (Array.isArray(value))
    return value.map(item => visit(item, depth + 1)); if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.some(([key]) => ['__proto__', 'constructor', 'prototype'].includes(key)))
        throw new AppError('Paramètre non autorisé.');
    return Object.fromEntries(entries.map(([key, item]) => [key, visit(item, depth + 1)]));
} return value; }; const result = visit(template); return z.record(z.unknown()).parse(result); }
export function adapterDigest(item: SocialAdapter) { const contract = { ...item, verifiedAt: undefined }; return digest(contract); }
