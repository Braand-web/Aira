import {identity,getResource,failure} from "@/lib/server";
import {renderPage} from "@/lib/pages";
import {AppError,safeFilename} from "@/lib/core.mjs";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const {tenant}=await identity(request);const r=await getResource(tenant,(await context.params).id);if(r.kind!=="page")throw new AppError("Page introuvable.",404);const html=renderPage(r.data.current);if(new URL(request.url).searchParams.has("download"))return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":'attachment; filename="'+safeFilename(r.title)+'.html"',"Content-Security-Policy":"sandbox"}});return Response.json({html,version:r.version});}catch(error){return failure(error);}}

