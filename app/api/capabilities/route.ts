import { identity, failure } from '@/lib/server';
import { workspaceCapabilities } from '@/lib/capabilities';
export async function GET(request: Request) { try {
    return Response.json(workspaceCapabilities(await identity(request)), { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (error) {
    return failure(error);
} }
