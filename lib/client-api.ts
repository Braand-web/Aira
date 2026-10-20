export function workspaceHeaders(initial?:HeadersInit){const h=new Headers(initial);if(typeof window!=='undefined'){const space=localStorage.getItem('aira.workspace');if(space){h.set('x-aira-workspace',space);document.cookie='aira_workspace='+encodeURIComponent(space)+'; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');}}return h;}
export async function api<T=unknown>(path:string,options?:RequestInit):Promise<T>{
 const response=await fetch(path,{...options,headers:workspaceHeaders(options?.headers)});
 const data:unknown=await response.json();
 if(!response.ok){const error=data&&typeof data==='object'?data as Record<string,unknown>:{};throw Object.assign(new Error(typeof error.error==='string'?error.error:'Impossible de terminer cette opération.'),{status:response.status,code:typeof error.code==='string'?error.code:undefined});}return data as T;
}
export const post=(data:unknown)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
