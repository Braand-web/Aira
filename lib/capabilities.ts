import { config } from './server';
import { modelReadiness } from './metering';
import { workReadiness } from './work';
import { researchReadiness } from './research';
import { browserReadiness } from './browser';
import { socialReadiness } from './social-adapters';
import { NETWORKS } from './platform-contracts';
import { falCatalog } from './providers';
import type { BillingIdentity } from './billing';
import { renderReadiness, videoEditingReadiness } from './media-render';
export function workspaceCapabilities(who: BillingIdentity) { const c = config(), model = modelReadiness(), work = workReadiness(), research = researchReadiness(), browser = browserReadiness(); let media = false; try {
    media = !!c.FAL_KEY && falCatalog().length > 0;
}
catch { /* An invalid catalog is unavailable. */ } return { asOf: Date.now(), canWrite: ['owner', 'admin', 'editor'].includes(who.role), canApprove: ['owner', 'admin', 'approver'].includes(who.role), conversation: { ready: model.ready, reason: model.reason }, work: { ready: work.enabled, reason: work.reason }, research, documents:{ready:true,formats:['docx','xlsx','pdf','html','csv','md'],pdfScripts:'latin'}, browser: { ready: browser.ready, reason: browser.ready ? null : 'verification_pending', limits: browser.limits }, media: { ready: media, reason: media ? null : 'configuration_pending' }, assembly: renderReadiness(), videoEditing:videoEditingReadiness(), social: NETWORKS.map(network => ({ network, ...socialReadiness(network) })), limits: { parallelTasks: 3, standardResearch: { queries: 5, pages: 10 }, latePublicationMinutes: 15 } }; }
