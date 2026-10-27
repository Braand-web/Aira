import {identity,failure} from '@/lib/server';
import {listRoutines,prepareRoutine} from '@/lib/routines';
export async function GET(request:Request){try{return Response.json(await listRoutines((await identity(request)).tenant),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return failure(error);}}
export async function POST(request:Request){try{return Response.json(await prepareRoutine(await identity(request,'write'),await request.json()),{status:201,headers:{'Cache-Control':'private, no-store'}});}catch(error){return failure(error);}}
