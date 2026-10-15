import {env} from "cloudflare:workers";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {AppError} from "./core.mjs";
import type {Resource} from "./contracts";
export const config=()=>env as Cloudflare.Env & Record<string,string|undefined>;
export function db(){if(!env.DB)throw new AppError("Stockage indisponible.",503,"storage_unavailable");return env.DB;}
export const uid=()=>crypto.randomUUID();
export async function identity(request?:Request){
 if(request&&request.method!=="GET"){const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new AppError("Origine non autorisée.",403);}
 const user=await getChatGPTUser();if(!user)throw new AppError("Connectez-vous pour enregistrer votre travail.",401,"authentication_required");
 const now=Date.now();await db().batch([db().prepare("INSERT OR IGNORE INTO workspaces (id,name,created_at) VALUES (?,?,?)").bind(user.userId,"Mon entreprise",now),db().prepare("INSERT OR IGNORE INTO members (id,workspace_id,user_id,role) VALUES (?,?,?,'owner')").bind(user.userId,user.userId,user.userId)]);
 return {user,tenant:user.userId};
}
export async function list(tenant:string,kind?:string){
 const query=kind?"SELECT * FROM resources WHERE workspace_id=? AND kind=? ORDER BY updated_at DESC LIMIT 200":"SELECT * FROM resources WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 300";
 const result=await db().prepare(query).bind(...(kind?[tenant,kind]:[tenant])).all();return result.results.map(decode) as Resource[];
}
export function decode(row:any){return {...row,data:JSON.parse(row.data||"{}")};}
export async function getResource(tenant:string,id:string){
 const row=await db().prepare("SELECT * FROM resources WHERE id=? AND workspace_id=?").bind(id,tenant).first();if(!row)throw new AppError("Élément introuvable.",404);return decode(row) as Resource;
}
export async function createResource(tenant:string,kind:string,title:string,data:unknown={},status="draft"){
 const id=uid(),now=Date.now();await db().prepare("INSERT INTO resources (id,workspace_id,kind,title,data,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,tenant,kind,title,JSON.stringify(data),status,now,now).run();return getResource(tenant,id);
}
export async function updateResource(tenant:string,id:string,version:number,patch:{title?:string;data?:unknown;status?:string}){
 const current=await getResource(tenant,id);const result=await db().prepare("UPDATE resources SET title=?,data=?,status=?,version=version+1,updated_at=? WHERE id=? AND workspace_id=? AND version=?").bind(patch.title??current.title,JSON.stringify(patch.data??current.data),patch.status??current.status,Date.now(),id,tenant,version).run();
 if(!result.meta.changes)throw new AppError("La version a changé. Actualisez avant de continuer.",409,"stale_version");return getResource(tenant,id);
}
export async function auditLog(tenant:string,action:string,target:string,detail:unknown={}){
 await db().prepare("INSERT INTO audit (id,workspace_id,actor,action,target,detail,created_at) VALUES (?,?,?,?,?,?,?)").bind(uid(),tenant,tenant,action,target,JSON.stringify(detail),Date.now()).run();
}
export function failure(error:unknown){
 if(error instanceof AppError)return Response.json({error:error.message,code:error.code},{status:error.status});
 if(error&&typeof error==="object"&&"issues" in error)return Response.json({error:"Informations incomplètes ou invalides.",code:"validation_error"},{status:400});
 console.error("Request failed",error instanceof Error?error.name:"unknown");return Response.json({error:"L’opération n’a pas abouti. Réessayez ou contactez le support.",code:"internal_error"},{status:500});
}
export async function seal(value:string){
 const key=config().TOKEN_ENCRYPTION_KEY;if(!key)throw new AppError("Chiffrement des connexions non configuré.",503);
 const raw=Uint8Array.from(atob(key),c=>c.charCodeAt(0)),k=await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt"]),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(value));return btoa(String.fromCharCode(...iv))+"."+btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
export async function unseal(value:string){
 const key=config().TOKEN_ENCRYPTION_KEY;if(!key)throw new AppError("Chiffrement indisponible.",503);
 const [iv,cipher]=value.split("."),raw=Uint8Array.from(atob(key),c=>c.charCodeAt(0)),k=await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["decrypt"]);
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:Uint8Array.from(atob(iv),c=>c.charCodeAt(0))},k,Uint8Array.from(atob(cipher),c=>c.charCodeAt(0))));
}

