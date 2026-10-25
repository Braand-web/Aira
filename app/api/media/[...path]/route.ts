import { identity, failure } from '@/lib/server';
import { mediaAssets, persistMedia } from '@/lib/media-assets';
import { AppError } from '@/lib/core.mjs';
type Context = {
    params: Promise<{
        path: string[];
    }>;
};
export async function GET(request: Request, context: Context) { try {
    const who = await identity(request), [id, section, ...rest] = (await context.params).path;
    if (!id || section !== 'assets' || rest.length)
        throw new AppError('Média introuvable.', 404);
    return Response.json(await mediaAssets(who.tenant, id), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return failure(error);
} }
export async function POST(request: Request, context: Context) { try {
    const who = await identity(request), [id, section, ...rest] = (await context.params).path;
    if (!id || section !== 'store' || rest.length)
        throw new AppError('Média introuvable.', 404);
    return Response.json(await persistMedia(who, id), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return failure(error);
} }
