import {z} from "zod";
import {AppError,safeWebURL,validateModelInput} from "./core.mjs";
import {config,db,unseal} from "./server";
const catalogItem=z.object({id:z.string().regex(/^[a-zA-Z0-9/_-]+$/),name:z.string(),kind:z.enum(["image","video","audio"]),credits:z.number().int().positive(),inputSchema:z.record(z.unknown()),description:z.string()});
export function falCatalog(){try{return z.array(catalogItem).max(50).parse(JSON.parse(config().FAL_CATALOG_JSON||"[]"));}catch{throw new AppError("Catalogue média invalide. Contactez l’administrateur.",503);}}
export async function metaToken(tenant:string){
 const row=await db().prepare("SELECT encrypted_token,expires_at FROM connections WHERE workspace_id=? AND provider='meta'").bind(tenant).first<{encrypted_token:string;expires_at:number}>();
 if(!row)throw new AppError("Connectez Meta for Business pour continuer.",412,"meta_not_connected");
 if(row.expires_at&&row.expires_at<Date.now())throw new AppError("La connexion Meta a expiré.",412,"meta_expired");return unseal(row.encrypted_token);
}
export async function metaGet(tenant:string,path:string,params:Record<string,string>={}){
 const version=config().META_GRAPH_VERSION;if(!version||!/^v\d+\.\d+$/.test(version))throw new AppError("Version de l’API Meta à configurer.",503);
 const url=new URL("https://graph.facebook.com/"+version+"/"+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 const response=await fetch(url,{headers:{Authorization:"Bearer "+await metaToken(tenant)},signal:AbortSignal.timeout(20000)});
 const data:any=await response.json();if(!response.ok)throw new AppError("Meta refuse cette lecture. Vérifiez les droits et l’état du compte.",response.status===401?412:502,"meta_error");return data;
}
export async function submitFal(model:string,input:Record<string,unknown>){
 const item=falCatalog().find(m=>m.id===model);if(!item)throw new AppError("Modèle non validé dans le catalogue.",403);
 validateModelInput(input,item.inputSchema);
 const key=config().FAL_KEY;if(!key)throw new AppError("Génération média non configurée.",503);
 // URLs can only be passed to fal. No arbitrary server-side URL fetch.
 for(const [k,v] of Object.entries(input)){if(k.endsWith("_url")&&typeof v==="string")safeWebURL(v);}
 const response=await fetch("https://queue.fal.run/"+model,{method:"POST",headers:{Authorization:"Key "+key,"Content-Type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(25000)});
 const data:any=await response.json();if(!response.ok)throw new AppError("fal.ai n’a pas accepté la génération.",502,"fal_rejected");if(!data.request_id)throw new AppError("Réponse média incertaine.",502,"uncertain_result");return data.request_id as string;
}
export async function falResult(model:string,id:string){
 const key=config().FAL_KEY;if(!key)throw new AppError("Génération média non configurée.",503);
 const root=model.split("/").slice(0,2).join("/");
 const endpoint="https://queue.fal.run/"+root+"/requests/"+encodeURIComponent(id);
 const headers={Authorization:"Key "+key};
 const response=await fetch(endpoint+"/status",{headers,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new AppError("Le fournisseur média ne répond pas.",502);
 const state:any=await response.json();if(state.status!=="COMPLETED")return {status:state.status};
 const result=await fetch(endpoint,{headers,signal:AbortSignal.timeout(20000)});
 if(!result.ok)throw new AppError("Le résultat média est indisponible.",502);
 return {status:"COMPLETED",output:await result.json()};
}

