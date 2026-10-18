import {failure} from '@/lib/server';
import {runDurableTick} from '@/lib/durable-missions';
import {requireOperationsScheduler} from '@/lib/operations';
export async function POST(request:Request){try{await requireOperationsScheduler(request);return Response.json(await runDurableTick(),{headers:{'Cache-Control':'no-store'}});}catch(error){return failure(error);}}
