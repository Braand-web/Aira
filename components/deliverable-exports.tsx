"use client";
import {useState} from 'react';
import {Download,LoaderCircle} from 'lucide-react';
import {workspaceHeaders} from '@/lib/client-api';
import type {Resource} from '@/lib/contracts';
export function DeliverableExports({resource}:{resource:Resource}){
 const [format,setFormat]=useState('docx'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const download=async()=>{if(busy)return;setBusy(true);setError('');try{
  const response=await fetch('/api/deliverables/'+encodeURIComponent(resource.id)+'/export?version='+resource.version+'&format='+format,{headers:workspaceHeaders()});
  if(!response.ok){const data=await response.json() as {error?:unknown};throw new Error(typeof data.error==='string'?data.error:'Export indisponible.');}
  const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=resource.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-')+'.'+format;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch(error){setError(error instanceof Error?error.message:'Export indisponible.');}finally{setBusy(false);}};
 return <div className="resource-detail"><div className="preview-toolbar"><select aria-label="Format du document" value={format} onChange={event=>setFormat(event.target.value)} disabled={busy}>{[['docx','Word (.docx)'],['pdf','PDF'],['xlsx','Excel (.xlsx)'],['csv','Tableau CSV'],['html','Document HTML'],['md','Markdown']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" className="button small secondary" onClick={()=>void download()} disabled={busy}>{busy?<LoaderCircle size={15} className="spin"/>:<Download size={15}/>} {busy?'Exportation…':'Télécharger'}</button></div>{error&&<p role="alert">{error}</p>}</div>;
}
