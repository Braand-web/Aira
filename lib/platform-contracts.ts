import { z } from 'zod';
export const WORK_STATES = ['draft', 'running', 'waiting_input', 'waiting_approval', 'waiting_external', 'paused', 'needs_reconciliation', 'completed', 'partial', 'failed', 'cancelled', 'expired'] as const;
export type WorkState = typeof WORK_STATES[number];
export const WORK_LABELS: Record<WorkState, string> = { draft: 'Brouillon', running: 'En cours', waiting_input: 'Votre réponse est nécessaire', waiting_approval: 'Votre accord est nécessaire', waiting_external: 'En attente d’un service', paused: 'En pause', needs_reconciliation: 'Vérification nécessaire', completed: 'Terminé', partial: 'Partiellement terminé', failed: 'Interrompu', cancelled: 'Annulé', expired: 'Mandat expiré' };
const ref = z.string().min(1).max(160);
export const timezoneSchema = z.string().max(100).refine(value => { try {
    new Intl.DateTimeFormat('fr', { timeZone: value });
    return true;
}
catch {
    return false;
} }, 'Fuseau horaire invalide.');
export const workInput = z.object({ objective: z.string().trim().min(3).max(2000), constraints: z.array(z.string().trim().min(1).max(500)).max(20).default([]), language: z.string().min(1).max(40).default('fr'), timezone: timezoneSchema.default('UTC'), researchDepth: z.enum(['standard', 'deep']).default('standard'), maxCredits: z.number().int().min(1).max(1000), expiresAt: z.number().int().positive(), steps: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/), title: z.string().trim().min(1).max(200), instruction: z.string().trim().min(3).max(4000), criteria: z.array(z.string().min(1).max(500)).min(1).max(10), dependsOn: z.array(z.string().max(60)).max(20).default([]), maxCredits: z.number().int().min(1).max(1000) }).strict()).min(1).max(20) }).strict();
export type WorkInput = z.infer<typeof workInput>;
export type WorkStepDTO = {
    id: string;
    ordinal: number;
    title: string;
    criteria: string[];
    dependsOn: string[];
    status: string;
    maxCredits: number;
    runId: string | null;
    result: Record<string, unknown> | null;
};
export type WorkDTO = {
    id: string;
    objective: string;
    constraints: string[];
    conversationId: string;
    status: WorkState;
    version: number;
    researchDepth: 'standard' | 'deep';
    language: string;
    timezone: string;
    maxCredits: number;
    spentCredits: number;
    reservedCredits: number;
    unresolved: boolean;
    expiresAt: number;
    updatedAt: number;
    errorCode: string | null;
    backgroundActive: boolean;
    steps: WorkStepDTO[];
    artifacts: {
        id: string;
        title: string;
        kind: string;
        status: string;
        version: number;
    }[];
};
export const workCommand = z.object({ action: z.enum(['activate', 'pause', 'resume', 'cancel']), version: z.number().int().positive(), commandId: z.string().uuid(), approved: z.boolean().optional() }).strict();
export const draftInput = z.object({ context: ref, version: z.number().int().nonnegative(), content: z.string().max(16000), attachments: z.array(ref).max(10).default([]) }).strict();
export const NETWORKS = ['instagram', 'facebook', 'linkedin', 'tiktok'] as const;
export type SocialNetwork = typeof NETWORKS[number];
export const NETWORK_LABELS: Record<SocialNetwork, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok' };
export const socialAsset = z.object({ id: ref, version: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const postInput = z.object({ accountId: ref, text: z.string().trim().max(12000), assets: z.array(socialAsset).max(10).default([]), format: z.enum(['text', 'image', 'carousel', 'video', 'story']), altText: z.string().max(2000).default(''), destination: z.string().url().max(2000).nullable().default(null), scheduledAt: z.number().int().positive(), timezone: timezoneSchema }).strict();
export const batchInput = z.object({ title: z.string().trim().min(1).max(160), brandId: ref.nullable().optional(), projectId: ref.nullable().optional(), posts: z.array(postInput).min(1).max(60) }).strict();
export type SocialPostInput = z.infer<typeof postInput>;
export type SocialAccountDTO = {
    id: string;
    network: SocialNetwork;
    label: string;
    targetId: string;
    timezone: string;
    status: string;
    version: number;
    verifiedAt: number;
    capabilities: {
        read: boolean;
        publish: boolean;
        comments: boolean;
        insights: boolean;
    };
    reason: string | null;
};
export type SocialPostDTO = SocialPostInput & {
    id: string;
    batchId: string;
    version: number;
    status: string;
    errorCode: string | null;
    receipt: {
        externalId?: string;
        url?: string;
        status?: string;
    } | null;
};
export type SocialBatchDTO = {
    id: string;
    title: string;
    version: number;
    status: string;
    digest: string | null;
    expiresAt: number | null;
    posts: SocialPostDTO[];
};
export const POST_LABELS: Record<string, string> = { draft: 'Brouillon', approved: 'Programmé', publishing: 'Envoi en cours', processing: 'Traitement en cours', published: 'Publié', rejected: 'Refusé', blocked: 'Intervention nécessaire', needs_reschedule: 'À reprogrammer', uncertain: 'Résultat à vérifier', cancelled: 'Annulé' };
export function canonical(value: unknown): string { return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item); }
export async function digest(value: unknown) { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new TextEncoder().encode(canonical(value)); return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join(''); }
export function validateDependencies(steps: {
    id: string;
    dependsOn: string[];
}[]) { const all = new Map(steps.map(step => [step.id, step])), visited = new Set<string>(), visiting = new Set<string>(); if (all.size !== steps.length)
    throw new Error('Identifiants d’étapes dupliqués.'); const visit = (id: string) => { if (visited.has(id))
    return; if (visiting.has(id) || !all.has(id))
    throw new Error('Dépendance absente ou cyclique.'); visiting.add(id); all.get(id)!.dependsOn.forEach(visit); visiting.delete(id); visited.add(id); }; steps.forEach(step => visit(step.id)); }
