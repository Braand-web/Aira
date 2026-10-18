import {servePublishedPage,submitPageLead} from '@/lib/pages';
import {failure} from '@/lib/server';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{return await servePublishedPage(request,(await context.params).id);}catch(error){return failure(error);}}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{return await submitPageLead(request,(await context.params).id);}catch(error){return failure(error);}}
