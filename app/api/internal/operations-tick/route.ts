import {failure} from '@/lib/server';
import {requireOperationsScheduler,runOperationsTick} from '@/lib/operations';
import {cleanupDrafts} from '@/lib/drafts';
export async function POST(request: Request) {
  try {
    await requireOperationsScheduler(request);
    await cleanupDrafts();
    return Response.json(await runOperationsTick(),{headers:{'Cache-Control':'no-store'}});
  } catch (error) {return failure(error);}
}
