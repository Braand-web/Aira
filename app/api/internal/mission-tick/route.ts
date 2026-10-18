import {config,failure} from '@/lib/server';
import {AppError} from '@/lib/core.mjs';
import {runDurableTick} from '@/lib/durable-missions';
export async function POST(request:Request){try{const secret=config().SCHEDULER_SECRET;if(!secret||request.headers.get('authorization')!=='Bearer '+secret)throw new AppError('Accès réservé au planificateur.',401);return Response.json(await runDurableTick());}catch(error){return failure(error);}}
