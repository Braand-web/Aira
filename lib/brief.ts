import { z } from 'zod';
import { authorize, createResource, getResource, updateResource, auditLog } from './server';
import { AppError } from './core.mjs';
import type { BillingIdentity } from './billing';
export const briefInput = z.object({ title: z.string().trim().min(1).max(160), summary: z.string().trim().min(1).max(2000), questions: z.array(z.object({ q: z.string().min(1).max(400), type: z.enum(['radio', 'check', 'text']), options: z.array(z.string().min(1).max(200)).max(8), optional: z.boolean() }).strict()).min(1).max(6) }).strict();
export async function prepareBrief(who: BillingIdentity, input: unknown) { await authorize(who.tenant, who.user.userId, 'write'); const p = briefInput.parse(input); if (p.questions.some(q => q.type !== 'text' && !q.options.length))
    throw new AppError('Proposez des choix ou une question libre.'); return createResource(who.tenant, 'brief', p.title, { ...p, answers: [], notice: 'Ce brief ne donne aucun accord de dépense ou de publication.' }, 'waiting_input'); }
export async function answerBrief(who: BillingIdentity, id: string, input: unknown) {
    await authorize(who.tenant, who.user.userId, 'write');
    const p = z.object({ version: z.number().int().positive(), answers: z.array(z.object({ selected: z.array(z.number().int().nonnegative()).max(8), custom: z.string().max(3000), skipped: z.boolean() }).strict()).max(6) }).strict().parse(input), resource = await getResource(who.tenant, id);
    if (resource.kind !== 'brief' || resource.status !== 'waiting_input')
        throw new AppError('Ce brief a déjà été traité ou n’est plus disponible.', 409);
    const brief = briefInput.parse({ title: resource.title, summary: resource.data.summary, questions: resource.data.questions });
    if (p.answers.length !== brief.questions.length)
        throw new AppError('Répondez à chaque question obligatoire.');
    for (const [i, question] of brief.questions.entries()) {
        const answer = p.answers[i];
        if (new Set(answer.selected).size !== answer.selected.length || answer.selected.some(value => value >= question.options.length) || question.type === 'text' && answer.selected.length || question.type === 'radio' && answer.selected.length > 1 || !question.optional && (answer.skipped || !answer.selected.length && !answer.custom.trim()))
            throw new AppError('Une réponse est invalide ou manquante.');
    }
    const updated = await updateResource(who.tenant, id, p.version, { status: 'saved', data: { ...resource.data, answers: p.answers, answeredAt: Date.now() } });
    await auditLog(who.tenant, who.user.userId, 'brief.answered', id);
    return updated;
}
