'use client';

import Image from 'next/image';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,AudioLines,Code2,FileText,Film,Folder,Globe,Image as ImageIcon,LayoutGrid,List,Pin,Plus,Search,Upload} from 'lucide-react';
import type {Resource} from '@/lib/contracts';
import {readBraandStorage} from '@/lib/client-storage';
import {libraryPresentation,libraryStatus} from '@/lib/library-presentation';
import {useFilePreview} from './file-preview/file-preview-provider';
import {previewFileFromResource,statusLabel} from './file-preview/types';
import styles from './library-gallery.module.css';

type Props={resources:Resource[];userId?:string;workspaceId?:string;loading:boolean;filePreviewEnabled:boolean;onOpen:(resource:Resource)=>void;onImport:()=>void;onAsk:(prompt:string)=>void};
const kinds=['file','media','proposal','deliverable','page'];
const date=(at:number)=>new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(at);
function readPins(key:string|null):string[]{if(!key)return [];try{const value:unknown=JSON.parse(readBraandStorage(key)||'[]');return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'&&id.length<=160).slice(0,200):[];}catch{return [];}}

function Cover({resource,filePreviewEnabled}:{resource:Resource;filePreviewEnabled:boolean}){
 const info=libraryPresentation(resource),{getSignedUrl}=useFilePreview(),root=useRef<HTMLDivElement>(null);
 const [signed,setSigned]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null);
 const raster=resource.kind==='file'&&['image/png','image/jpeg','image/webp'].includes(info.mime)&&resource.status==='ready';
 useEffect(()=>{
  if(!raster||!filePreviewEnabled)return;
  let disposed=false,started=false;
  const load=()=>{if(started)return;started=true;void getSignedUrl(resource.id,'thumbnail').then(url=>{if(!disposed)setSigned(url);}).catch(()=>{});};
  const element=root.current;
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();load();}},{rootMargin:'160px'});
  if(element&&observer)observer.observe(element);else load();
  return()=>{disposed=true;observer?.disconnect();};
 },[resource.id,raster,filePreviewEnabled,getSignedUrl]);
 const image=info.image||(raster?(filePreviewEnabled?signed:`/api/files?id=${encodeURIComponent(resource.id)}&preview=thumbnail`):null);
 const Icon=resource.kind==='page'?Globe:info.type==='Vidéo'?Film:info.type==='Audio'?AudioLines:info.type==='Image'?ImageIcon:info.source?Code2:FileText;
 return <div ref={root} className={styles.cover} data-kind={resource.kind}>
  <Icon size={23} strokeWidth={1.4} className={styles.listIcon}/>
  {image&&failed!==image?<Image src={image} alt="" width={640} height={480} unoptimized loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(image)}/>:resource.kind==='page'?<div className={styles.pagePreview}><span>{resource.title}</span><strong>{info.excerpt||'Page enregistrée'}</strong><Globe size={18}/></div>:info.excerpt&&['deliverable','proposal'].includes(resource.kind)?<div className={styles.documentPreview}><span>{info.type}</span><strong>{resource.title}</strong><p>{info.excerpt}</p></div>:<div className={styles.typePreview}><Icon size={28} strokeWidth={1.4}/><span>{info.type}</span></div>}
  <span className={styles.coverType}><Icon size={13}/>{info.type}</span>
 </div>;
}

export default function LibraryGallery({resources,userId,workspaceId,loading,filePreviewEnabled,onOpen,onImport,onAsk}:Props){
 const {openPreview}=useFilePreview(),storageKey=userId&&workspaceId?`braand.library.pins:${userId}:${workspaceId}`:null;
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[view,setView]=useState<'grid'|'list'>('grid'),[sort,setSort]=useState('recent'),[pins,setPins]=useState(()=>readPins(storageKey)),[notice,setNotice]=useState('');
 const items=resources.filter(resource=>kinds.includes(resource.kind)&&resource.status!=='deleted'&&(!workspaceId||resource.workspace_id===workspaceId));
 const visible=items.filter(resource=>(filter==='all'||filter==='pinned'&&pins.includes(resource.id)||libraryPresentation(resource).category===filter)&&(`${resource.title} ${libraryPresentation(resource).type}`).toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title,'fr'):b.updated_at-a.updated_at||a.id.localeCompare(b.id));
 const fileIds=items.filter(resource=>resource.kind==='file'&&resource.status==='ready').map(resource=>resource.id);
 const togglePin=(resource:Resource)=>{setPins(current=>{const next=current.includes(resource.id)?current.filter(id=>id!==resource.id):[resource.id,...current].slice(0,200);if(storageKey)try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}return next;});setNotice(pins.includes(resource.id)?'Ressource retirée des épinglés.':'Ressource épinglée sur cet appareil.');};
 const open=(resource:Resource)=>{if(resource.kind==='file'&&filePreviewEnabled)openPreview(resource.id,{contextFileIds:fileIds});else onOpen(resource);};
 const create=()=>onAsk('Je souhaite créer un nouveau contenu ou livrable. Aide-moi à préciser le résultat attendu et le format avant de commencer.');
 return <div className={styles.gallery} data-library-gallery>
  <header className={styles.header}><div><h1>Bibliothèque</h1><p>Vos créations, documents et fichiers, au même endroit.</p></div><div className={styles.actions}><button type="button" className="button secondary" onClick={onImport}><Upload size={16}/>Importer</button><button type="button" className="button primary" onClick={create}><Plus size={16}/>Créer</button></div></header>
  <div className={styles.toolbar}><label className={styles.search}><Search size={17}/><input type="search" aria-label="Rechercher dans la bibliothèque" placeholder="Rechercher dans la bibliothèque" value={query} onChange={event=>setQuery(event.target.value)}/></label><div className={styles.tools}><select aria-label="Trier la bibliothèque" value={sort} onChange={event=>setSort(event.target.value)}><option value="recent">Récemment modifiés</option><option value="name">Nom</option></select><div className={styles.viewSwitch} role="group" aria-label="Présentation de la bibliothèque"><button type="button" aria-label="Vue galerie" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><LayoutGrid size={16}/></button><button type="button" aria-label="Vue liste" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={17}/></button></div></div></div>
  <div className={styles.filters} role="group" aria-label="Contenu de la bibliothèque">{[['all','Tout'],['creations','Créations'],['documents','Documents'],['pages','Pages'],...(pins.some(id=>items.some(resource=>resource.id===id))?[['pinned','Épinglés']]:[])].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{id==='pinned'&&<Pin size={13}/>} {label}</button>)}</div>
  <p className={styles.srOnly} role="status" aria-live="polite">{notice}</p>
  {loading?<div className={styles.skeleton} role="status" aria-label="Chargement de la bibliothèque">{[0,1,2,3,4,5].map(index=><div key={index}/>)}</div>:visible.length?<>
   <div className={styles.sectionLabel}><strong>{filter==='pinned'?'À portée de main':sort==='name'?'Toutes les ressources':'Récemment modifiés'}</strong><span aria-live="polite">{visible.length} élément{visible.length>1?'s':''}</span></div>
   <div className={view==='grid'?styles.grid:styles.list} role="list" aria-label="Ressources de la bibliothèque">{visible.map(resource=>{const info=libraryPresentation(resource),file=resource.kind==='file'?previewFileFromResource(resource):null,disabled=!!file&&file.status!=='ready';return <article key={resource.id} className={styles.item} role="listitem" data-library-resource data-kind={resource.kind}>
    <button type="button" className={styles.open} onClick={()=>open(resource)} disabled={disabled} aria-label={'Ouvrir '+resource.title} title={resource.title}><Cover resource={resource} filePreviewEnabled={filePreviewEnabled}/><span className={styles.copy}><strong>{resource.title}</strong><span>{info.type} · {file?statusLabel(file.status):libraryStatus(resource.status)}</span></span><time className={styles.modified} dateTime={new Date(resource.updated_at).toISOString()}>{date(resource.updated_at)}</time>{view==='list'&&<ArrowUpRight size={16} className={styles.openArrow}/>}</button>
    <button type="button" className={styles.pin} aria-label={(pins.includes(resource.id)?'Désépingler ':'Épingler ')+resource.title} aria-pressed={pins.includes(resource.id)} onClick={()=>togglePin(resource)}><Pin size={15}/></button>
   </article>;})}</div>
  </>:<section className={styles.empty}><Folder size={28} strokeWidth={1.4}/><h2>{items.length?'Aucune correspondance':'Tout commence par une idée'}</h2><p>{items.length?'Essayez un autre mot ou un autre filtre.':'Les ressources créées dans vos discussions et les fichiers importés apparaîtront ici.'}</p>{items.length?<button type="button" className="button secondary" onClick={()=>{setQuery('');setFilter('all');}}>Voir toutes les ressources</button>:<div className={styles.actions}><button type="button" className="button secondary" onClick={onImport}><Upload size={15}/>Importer un fichier</button><button type="button" className="button primary" onClick={create}>Créer avec Braand<ArrowUpRight size={15}/></button></div>}</section>}
 </div>;
}
