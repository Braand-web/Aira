import { z } from 'zod';
import { AppError } from './core.mjs';
import { browserService } from './browser';
import type { AgentScope } from './agent-state';
import type { RunBudget } from './metering';
export async function executePlatformTool(name: string, input: unknown, scope: AgentScope, budget: RunBudget): Promise<unknown> {
    const parseId = () => z.object({ id: z.string().min(1).max(160) }).strict().parse(input).id;
    switch (name) {
        case 'capabilities': return (await import('./capabilities')).workspaceCapabilities(budget.who);
        case 'prepare_brief': return (await import('./brief')).prepareBrief(budget.who, input);
        case 'prepare_work': {const parsed=z.object({id:z.string().max(160).optional(),version:z.number().int().positive().optional()}).passthrough().parse(input),{id,version,...mandate}=parsed;if(id||version){if(!id||!version)throw new AppError('Identifiant et version du brouillon requis.');return (await import('./work')).reviseWork(budget.who,id,version,mandate);}return (await import('./work')).prepareWork(budget.who,scope.conversationId,mandate);}
        case 'get_work': return (await import('./work')).getWork(scope.tenant, parseId());
        case 'research_web': return (await import('./research')).researchWeb(scope, budget, input);
        case 'read_web_source': return (await import('./research')).readWebSource(scope, budget, input);
        case 'social_accounts': return (await import('./social')).socialAccounts(scope.tenant);
        case 'prepare_publications': {
            const result = await (await import('./social')).createSocialBatch(budget.who, input);
            return (await import('./server')).getClientResource(scope.tenant, result.id);
        }
        case 'get_publications': {
            const { id } = z.object({ id: z.string().max(160).optional() }).strict().parse(input);
            return id ? (await import('./social')).getSocialBatch(scope.tenant, id) : (await import('./social')).listSocialBatches(scope.tenant);
        }
        case 'prepare_social_reply': return (await import('./social')).prepareReply(budget.who, input);
        case 'browser_capabilities': return (await import('./browser')).browserReadiness();
        case 'browser_session_result': {
            const id = parseId();
            return { session: await browserService.get(budget.who, id), artifacts: await browserService.artifacts(budget.who, id) };
        }
        case 'inspect_media': return (await import('./media-assets')).inspectMedia(budget, input);
        case 'assemble_media': return (await import('./media-render')).prepareAssembly(budget.who, input);
        case 'prepare_video_edit': return (await import('./media-render')).prepareVideoEdit(budget.who, input);
        case 'get_video_edit_result': return (await import('./media-render')).videoEditResult(budget.who, input);
        default: throw new AppError('Outil indisponible.', 403);
    }
}
export async function trackArtifact(...args: Parameters<typeof import('./work')['trackWorkArtifact']>) { return (await import('./work')).trackWorkArtifact(...args); }
