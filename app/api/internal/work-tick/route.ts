import { failure } from '@/lib/server';
import { requireOperationsScheduler } from '@/lib/operations';
import { runWorkTick } from '@/lib/work';
export async function POST(request: Request) { try {
    await requireOperationsScheduler(request);
    return Response.json(await runWorkTick(undefined, new URL(request.url).searchParams.get('workId') || undefined), { headers: { 'Cache-Control': 'no-store' } });
}
catch (error) {
    return failure(error);
} }
