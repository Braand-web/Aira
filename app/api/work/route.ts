import { z } from 'zod';
import { identity, failure } from '@/lib/server';
import { listWork, prepareWork } from '@/lib/work';
export async function GET(request: Request) { try {
    const who = await identity(request), url = new URL(request.url);
    return Response.json(await listWork(who.tenant, url.searchParams.get('conversationId') || undefined), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return failure(error);
} }
export async function POST(request: Request) { try {
    const who = await identity(request), { conversationId, plan } = z.object({ conversationId: z.string().min(1).max(160), plan: z.unknown() }).strict().parse(await request.json());
    return Response.json(await prepareWork(who, conversationId, plan), { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return failure(error);
} }
