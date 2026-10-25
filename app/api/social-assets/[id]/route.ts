import { readSocialAsset } from '@/lib/social';
import { failure } from '@/lib/server';
export async function GET(request: Request, context: {
    params: Promise<{
        id: string;
    }>;
}) { try {
    return await readSocialAsset((await context.params).id, new URL(request.url).searchParams.get('token') || '');
}
catch (error) {
    return failure(error);
} }
