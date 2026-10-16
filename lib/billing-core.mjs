import {AppError} from './core.mjs';

export const CATALOG_VERSION='2026-10-16.1';
export const CREDIT_SCALE=100;
export const DAY=86400000;
export const PLANS=Object.freeze({
 pro:{name:'Pro',periodPrice:9900,annualPrice:99000,credits:200,members:1,spaces:1,projects:10,storage:2*1024**3,transfer:10*1024**3,concurrency:1},
 business:{name:'Business',periodPrice:29900,annualPrice:299000,credits:600,members:5,spaces:5,projects:50,storage:10*1024**3,transfer:50*1024**3,concurrency:3}
});
export const PACKS=[50,100,250,500,1000,2500,5000];
export function topupPrice(quantity){
 if(!Number.isSafeInteger(quantity)||quantity<50||quantity>10000)throw new AppError('Choisissez entre 50 et 10 000 crédits entiers.',400,'invalid_quantity');
 let left=quantity,total=0;for(const [size,price] of [[100,50],[400,45],[500,44],[9000,43]]){const n=Math.min(left,size);total+=n*price;left-=n;}return total;
}
export function product(input){
 if(input.kind==='topup')return {kind:'topup',quantity:input.quantity,credits:input.quantity,amount:topupPrice(input.quantity),currency:'XAF',version:CATALOG_VERSION};
 if(input.kind!=='subscription'||!PLANS[input.plan]||!['period','annual'].includes(input.cycle))throw new AppError('Offre invalide.');
 const p=PLANS[input.plan];return {kind:'subscription',plan:input.plan,cycle:input.cycle,credits:p.credits,amount:input.cycle==='annual'?p.annualPrice:p.periodPrice,currency:'XAF',version:CATALOG_VERSION};
}
export function anniversary(anchor,months){
 const d=new Date(anchor);if(!Number.isFinite(d.getTime())||!Number.isInteger(months))throw new AppError('Date invalide.');
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);
 d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.getTime();
}
export function periods(start,cycle,credits){
 return Array.from({length:cycle==='annual'?12:1},(_,i)=>({index:i,start:cycle==='annual'?anniversary(start,i):start,end:cycle==='annual'?anniversary(start,i+1):start+30*DAY,units:credits*CREDIT_SCALE}));
}
export function marginCheck(p,e){
 const valid=['taxBps','feeBps','feeFixed','unitCost','monthlyServiceCost','riskBps'].every(k=>Number.isFinite(e?.[k])&&e[k]>=0);
 if(!valid||e.unitCost<4||e.taxBps>10000||e.feeBps>10000||e.riskBps>10000)return {eligible:false,reason:'Coûts ou fiscalité non validés.'};
 const months=p.kind==='subscription'?(p.cycle==='annual'?12:1):0;
 const net=p.amount/(1+e.taxBps/10000),credits=p.credits*(months||1);
 const cost=credits*e.unitCost+p.amount*e.feeBps/10000+e.feeFixed+months*e.monthlyServiceCost+net*e.riskBps/10000;
 const margin=net>0?1-cost/net:0;return {eligible:margin>=.75,margin,netRevenue:net,variableCost:cost,fullConsumptionCredits:credits};
}
export function roleAllows(role,action){
 return ({owner:['read','write','approve','billing','manage'],admin:['read','write','approve','manage'],editor:['read','write'],approver:['read','approve'],reader:['read']}[role]||[]).includes(action);
}
export function usageUnits(usage,rate){
 for(const k of ['input_tokens','output_tokens'])if(!Number.isSafeInteger(usage?.[k])||usage[k]<0)throw new AppError('Consommation fournisseur incomplète.',409,'usage_unknown');
 const input=usage.input_tokens,output=usage.output_tokens,cacheWrite=usage.cache_creation_input_tokens||0,cacheRead=usage.cache_read_input_tokens||0;
 if(![cacheWrite,cacheRead].every(n=>Number.isSafeInteger(n)&&n>=0))throw new AppError('Consommation cache invalide.');
 const hour=usage.cache_creation?.ephemeral_1h_input_tokens||0;
 if(!Number.isSafeInteger(hour)||hour<0||hour>cacheWrite||(hour>0&&!Number.isFinite(rate.cacheWriteHour)))throw new AppError('Tarif de cache longue durée inconnu.',409,'usage_unknown');
 const xaf=(input*rate.input+output*rate.output+(cacheWrite-hour)*rate.cacheWrite+hour*(rate.cacheWriteHour||0)+cacheRead*rate.cacheRead)/1e6*rate.usdXaf+rate.overheadXaf;
 return {xaf,units:Math.ceil(xaf/4*100),usage};
}
export function upgradeQuote(sub,now){
 if(sub.plan!=='pro'||now<sub.start_at||now>=sub.end_at)throw new AppError('Aucun forfait Pro actif à faire évoluer.',409);
 const old=PLANS.pro,next=PLANS.business,delta=sub.cycle==='annual'?next.annualPrice-old.annualPrice:next.periodPrice-old.periodPrice;
 const current=periods(sub.start_at,sub.cycle,old.credits).find(p=>p.start<=now&&p.end>now);
 return {amount:Math.ceil(delta*(sub.end_at-now)/(sub.end_at-sub.start_at)),units:Math.floor((next.credits-old.credits)*100*(current.end-now)/(current.end-current.start)),periodEnd:current.end};
}
export function decimalXaf(value){if(!/^\d+(?:\.0{1,2})?$/.test(String(value)))throw new AppError('Montant fournisseur invalide.',409);const n=Number(value);if(!Number.isSafeInteger(n))throw new AppError('Montant hors limites.');return n;}
export async function verifyWebhook(raw,headers,secret,now=Date.now()){
 const stamp=headers.get('x-webhook-timestamp'),signature=headers.get('x-webhook-signature');
 if(!secret||!/^\d{10}$/.test(stamp||'')||! /^[a-f0-9]{64}$/.test(signature||'')||Math.abs(now/1000-Number(stamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),s=>parseInt(s,16)),new TextEncoder().encode(stamp+'.'+raw));
}
