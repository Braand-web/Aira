"use client";
import {useEffect} from 'react';
import {api} from '@/lib/client-api';
const labels:Record<string,string>={completed:'Résultat disponible',waiting_approval:'Votre validation est attendue',waiting_input:'Une information est nécessaire',needs_reconciliation:'Un résultat doit être vérifié',partial:'Résultat partiel disponible'};
/** Surface actual work transitions while the user is elsewhere; never invent background progress. */
export function WorkNotificationWatch({enabled,workspaceId,onNotice}:{enabled:boolean;workspaceId?:string;onNotice:(notice:string)=>void}){
 useEffect(()=>{if(!enabled||!workspaceId)return;let stopped=false,busy=false;const states=new Map<string,string>(),controller=new AbortController();
  const poll=async()=>{if(stopped||busy||document.hidden)return;busy=true;try{const result=await api<{items:{id:string;status:string;objective:string}[]}>('/api/work?summary=1',{headers:{'x-braand-workspace':workspaceId},signal:controller.signal});if(stopped)return;for(const item of result.items||[]){const prior=states.get(item.id);if(prior&&prior!==item.status&&labels[item.status])onNotice(labels[item.status]+' · '+item.objective.slice(0,100));states.set(item.id,item.status);}}catch{/* The work panel provides actionable loading errors; no noisy polling banners. */}finally{busy=false;}};
  void poll();const timer=window.setInterval(()=>{if(states.size>200)states.clear();void poll();},20000);const visible=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visible);return()=>{stopped=true;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[enabled,workspaceId,onNotice]);
 return null;
}
