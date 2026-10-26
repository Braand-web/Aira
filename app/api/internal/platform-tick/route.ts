import { failure } from '@/lib/server';
import { requireOperationsScheduler } from '@/lib/operations';
import { runWorkTick, flushWorkOutbox } from '@/lib/work';
import { runSocialTick } from '@/lib/social';
import { cleanupDrafts } from '@/lib/drafts';
import { runMediaTick } from '@/lib/media-jobs';
import { runRenderTick } from '@/lib/media-render';
export async function POST(request: Request) { try {
    await requireOperationsScheduler(request);
    await cleanupDrafts();
    await flushWorkOutbox();
    const media = await runMediaTick(), render = await runRenderTick(), work = await runWorkTick(), social = await runSocialTick();
    return Response.json({ media, render, work, social }, { headers: { 'Cache-Control': 'no-store' } });
}
catch (error) {
    return failure(error);
} }
