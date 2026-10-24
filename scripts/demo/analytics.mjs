// Synthetic reporting data for the isolated preview and offline UI tests only.
import {analyticsRange} from '../../lib/analytics.mjs';
export const DEMO_AD_ACCOUNT={id:'act_demo_naya',name:'Maison Naya · compte fictif',currency:'XAF',timezone_name:'Africa/Douala'};
const campaigns=[
 {campaign_id:'demo-cacao',campaign_name:'Coffret cacao · découverte',spend:18400,impressions:54200,clicks:1250},
 {campaign_id:'demo-cafe',campaign_name:'Café signature · collection',spend:12600,impressions:38600,clicks:930},
 {campaign_id:'demo-hibiscus',campaign_name:'Infusion hibiscus · retours clients',spend:7000,impressions:24500,clicks:620}
];
function distribute(total,weights){let assigned=0;const sum=weights.reduce((a,b)=>a+b,0);return weights.map((weight,index)=>{const next=index===weights.length-1?total-assigned:Math.round(total*weight/sum);assigned+=next;return next;});}
function daysFor(range,previous=false){return Array.from({length:range.days},(_,index)=>new Date(Date.parse((previous?range.previousSince:range.since)+'T00:00:00Z')+index*86400000).toISOString().slice(0,10));}
export function demoAnalytics(days=30,now=Date.now()){
 const range=analyticsRange(days,DEMO_AD_ACCOUNT.timezone_name,now),dates=daysFor(range);
 const current=campaigns.map(campaign=>({...campaign,spend:Math.round(campaign.spend*days/30),impressions:Math.round(campaign.impressions*days/30),clicks:Math.round(campaign.clicks*days/30),date_start:range.since,date_stop:range.until}));
 const daily=(previous=false)=>{
  const list=previous?daysFor(range,true):dates;
  const weights=list.map((_,index)=>1+0.2*Math.sin(index*1.8)+(previous?0:0.6*index/Math.max(1,days-1)));
  const totals=Object.fromEntries(['spend','impressions','clicks'].map(key=>[key,current.reduce((sum,row)=>sum+row[key],0)]));
  const parts=Object.fromEntries(['spend','impressions','clicks'].map(key=>[key,distribute(Math.round(totals[key]*(previous?(key==='spend'?1.15:key==='clicks'?0.8:0.9):1)),weights)]));
  return list.map((day,index)=>({date_start:day,date_stop:day,spend:String(parts.spend[index]),impressions:String(parts.impressions[index]),clicks:String(parts.clicks[index])}));
 };
 return {account:DEMO_AD_ACCOUNT,insights:{data:current},daily:{data:daily()},comparison:{data:daily(true)},range,fetchedAt:new Date(now).toISOString(),hasMore:false,dailyHasMore:false,comparisonHasMore:false,demonstration:true,warnings:[]};
}
