export class AppError extends Error { constructor(message,status=400,code="invalid_request"){super(message);this.status=status;this.code=code;} }
export function assertVersion(actual,expected){if(actual!==expected)throw new AppError("Cette version a changé. Consultez-la avant de confirmer.",409,"stale_version");}
export function assertMandate(mandate,action,now=Date.now()){
 if(!mandate||mandate.status!=="active"||!Array.isArray(mandate.actions)||!Array.isArray(mandate.countries)||!Number.isFinite(mandate.remainingCredits)||!Number.isFinite(mandate.remainingAdSpend))throw new AppError("Mandat inactif ou invalide.",403);
 if(!Number.isFinite(Date.parse(mandate.startsAt))||!Number.isFinite(Date.parse(mandate.endsAt))||now<Date.parse(mandate.startsAt)||now>=Date.parse(mandate.endsAt))throw new AppError("Mandat hors période.",403);
 if(!mandate.actions.includes(action.type)||action.workspaceId!==mandate.workspaceId)throw new AppError("Action hors mandat.",403);
 if(!Number.isFinite(action.credits)||!Number.isFinite(action.adSpend)||action.credits<0||action.adSpend<0||action.credits>mandate.remainingCredits||action.adSpend>mandate.remainingAdSpend)throw new AppError("Plafond dépassé.",403);
 if(action.country&&!mandate.countries.includes(action.country))throw new AppError("Pays hors mandat.",403);
}
export function missionTransition(from,to){
 const transitions={draft:["planned","cancelled"],planned:["running","suspended","cancelled"],running:["waiting_external","waiting_user","completed","failed","suspended"],waiting_external:["running","suspended","failed"],waiting_user:["running","suspended","cancelled"],suspended:["planned","cancelled"],failed:["planned","cancelled"]};
 if(!transitions[from]?.includes(to))throw new AppError("Transition de mission interdite.",409);return to;
}
export function safeWebURL(input){
 let u;try{u=new URL(input);}catch{throw new AppError("URL invalide.");}
 if(u.protocol!=="https:"||u.username||u.password||u.port||!u.hostname.includes(".")||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)||u.hostname.includes(":")||u.hostname.endsWith(".local")||u.hostname.endsWith(".internal"))throw new AppError("URL HTTPS publique requise.");return u.href;
}
export function safeFilename(name){return name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"fichier";}
export function validateModelInput(value,schema,depth=0){
 if(depth>3)throw new AppError("Paramètres média trop imbriqués.");
 if(!schema||schema.type!=="object"||schema.additionalProperties!==false||!schema.properties||!value||typeof value!=="object"||Array.isArray(value))throw new AppError("Schéma de modèle ou paramètres invalides.");
 for(const name of schema.required||[])if(!(name in value))throw new AppError("Paramètre média requis : "+name);
 for(const [name,item] of Object.entries(value)){
  const rule=schema.properties[name];if(!rule)throw new AppError("Paramètre média non autorisé : "+name);
  if(rule.enum&&!rule.enum.includes(item))throw new AppError("Valeur média non autorisée : "+name);
  if(rule.type==="string"&&(typeof item!=="string"||item.length>(rule.maxLength??16000)))throw new AppError("Texte média invalide : "+name);
  if(["number","integer"].includes(rule.type)&&(typeof item!=="number"||!Number.isFinite(item)||(rule.type==="integer"&&!Number.isInteger(item))||item<(rule.minimum??0)||item>(rule.maximum??1)))throw new AppError("Limite média dépassée : "+name);
  if(rule.type==="boolean"&&typeof item!=="boolean")throw new AppError("Option média invalide : "+name);
  if(rule.type==='array'){
   if(!Array.isArray(item)||!Number.isSafeInteger(rule.maxItems)||rule.maxItems<1||rule.maxItems>50||item.length>rule.maxItems||item.length<(rule.minItems??0)||!rule.items||!['string','integer','number','boolean'].includes(rule.items.type))throw new AppError('Liste média non bornée ou invalide : '+name);
   for(const entry of item)validateModelInput({entry},{type:'object',additionalProperties:false,required:['entry'],properties:{entry:rule.items}},depth+1);
  }
  if(!["string","number","integer","boolean","array"].includes(rule.type))throw new AppError("Type média non pris en charge : "+name);
 }
 return value;
}
export function validateMediaInput(value,schema){
 validateModelInput(value,schema);
 for(const [name,item] of Object.entries(value)){
  if(name.endsWith('_url')&&typeof item==='string')safeWebURL(item);
  if(name.endsWith('_urls')&&Array.isArray(item))for(const url of item){if(typeof url!=='string')throw new AppError('Référence média invalide.');safeWebURL(url);}
  if(schema.properties[name]?.format==='uri'&&typeof item==='string')safeWebURL(item);
 }
 return value;
}
export function parseSSEFrame(frame){
 let event="message",id;const data=[];for(const line of frame.split(/\r?\n/)){if(line.startsWith("event:"))event=line.slice(6).trim();if(line.startsWith("id:"))id=line.slice(3).trim();if(line.startsWith("data:"))data.push(line.slice(5).trimStart());}
 if(!data.length)return null;const raw=data.join("\n").trim();if(raw==="[DONE]")return null;return {event,data:JSON.parse(raw),...(id!==undefined?{id}:{})};
}
export async function* parseSSE(stream){
 const reader=stream.getReader(),decoder=new TextDecoder();let buffer="";
 try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let match;while((match=/\r?\n\r?\n/.exec(buffer))){const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);const event=parseSSEFrame(frame);if(event)yield event;}}buffer+=decoder.decode();if(buffer.trim()){const event=parseSSEFrame(buffer);if(event)yield event;}}finally{reader.releaseLock();}
}
export function computeMetrics(rows){
 const spend=rows.reduce((n,r)=>n+Number(r.spend||0),0),impressions=rows.reduce((n,r)=>n+Number(r.impressions||0),0),clicks=rows.reduce((n,r)=>n+Number(r.clicks||0),0);
 return {spend,impressions,clicks,cpc:clicks?spend/clicks:null,ctr:impressions?clicks/impressions*100:null};
}
export function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

