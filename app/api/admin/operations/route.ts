import {z} from 'zod';
import {config, failure} from '@/lib/server';
import {AppError} from '@/lib/core.mjs';
import {requireOperationsAdmin,operationsSummary,raiseOperationalAlert} from '@/lib/operations';

export async function GET(request: Request) {
  try {await requireOperationsAdmin(request);return Response.json(await operationsSummary(),{headers:{'Cache-Control':'private, no-store'}});}
  catch (error) {return failure(error);}
}
export async function POST(request: Request) {
  try {
    await requireOperationsAdmin(request);
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new AppError('Origine non autorisée.',403);
    const raw = await request.text();
    if (raw.length > 1000) throw new AppError('Demande trop volumineuse.',413);
    const input = z.object({action:z.literal('test-alert'),idempotencyKey:z.string().uuid()}).strict().parse(JSON.parse(raw));
    if (!['test','staging'].includes(config().APP_ENV || '')) throw new AppError('Alerte de test réservée à la préproduction.',403);
    // Queue only. No real email is sent by this route.
    return Response.json(await raiseOperationalAlert('test:' + input.idempotencyKey,'test_alert',input.idempotencyKey),{status:201});
  } catch (error) {return failure(error);}
}
