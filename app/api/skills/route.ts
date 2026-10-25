import { identity, failure } from '@/lib/server';
import { skillCatalogMetadata } from '@/lib/skills/registry';
export async function GET(request: Request) { try {
    await identity(request);
    return Response.json({ items: skillCatalogMetadata() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return failure(error);
} }
