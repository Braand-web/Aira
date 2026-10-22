"use client";

import {useId} from 'react';
import {ArrowUpRight,Megaphone,ShieldCheck,SlidersVertical} from 'lucide-react';
import styles from './billing-offers.module.css';

export type BillingPlan = {
 name:string;periodPrice:number;annualPrice:number|null;credits:number;members:number;
 spaces:number;projects:number;storage:number;transfer:number;concurrency:number;
};
export type PlanId='essential'|'pro'|'business';
export const PLAN_IDS:PlanId[]=['essential','pro','business'];
export const planName=(plan:unknown)=>plan==='essential'?'Essentiel':plan==='pro'?'Pro':plan==='business'?'Business':'Aïra';
type Props={
 plans:Record<PlanId,BillingPlan>;free:{credits:number;days:number;enabled:boolean};
 paymentsEnabled:boolean;priceLabel:string;
 selected:PlanId;onSelect:(plan:PlanId)=>void;
 currentPlan?:string;busy:boolean;owner:boolean;onChoose:(plan:PlanId)=>void;
 onUpgrade:(plan:PlanId)=>void;onDiscover:()=>void;
};
const number=(value:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value);

function CreditInstrument({credits,maximum}:{credits:number;maximum:number}){
 const id=useId().replace(/:/g,'');
 const fraction=maximum>0?Math.min(1,Math.max(0,credits/maximum)):0;
 const arc=2*Math.PI*150,ticks=2*Math.PI*178;
 return <div className={styles.gauge}>
  <svg viewBox="0 0 400 400" aria-hidden="true" focusable="false">
   <defs>
    <linearGradient id={id+'-arc'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7dd3fc"/><stop offset=".55" stopColor="#8f96ff"/><stop offset="1" stopColor="#c084fc"/></linearGradient>
    <mask id={id+'-lit'}><circle className={styles.tickMask} cx="200" cy="200" r="178" style={{strokeDasharray:`${ticks*fraction} ${ticks}`}}/></mask>
   </defs>
   <g transform="rotate(-90 200 200)">
    <circle className={styles.ticks} cx="200" cy="200" r="178"/>
    <circle className={`${styles.ticks} ${styles.litTicks}`} cx="200" cy="200" r="178" mask={`url(#${id}-lit)`}/>
    <circle className={styles.track} cx="200" cy="200" r="150"/>
    <circle className={styles.arc} cx="200" cy="200" r="150" stroke={`url(#${id}-arc)`} style={{strokeDasharray:`${arc*fraction} ${arc}`}}/>
   </g>
   <circle className={styles.inner} cx="200" cy="200" r="126"/>
   <circle className={styles.innerRing} cx="200" cy="200" r="104"/>
   <g className={styles.knob} style={{transform:`rotate(${fraction*359}deg)`}}><circle className={styles.knobGlow} cx="200" cy="50" r="9"/><circle cx="200" cy="50" r="3.5" fill="white"/></g>
  </svg>
  <div className={styles.gaugeValue} aria-live="polite" aria-atomic="true"><span>Crédits</span><strong>{number(credits)}</strong><span>pour 30 jours</span></div>
 </div>;
}

export default function BillingOffers({plans,free,paymentsEnabled,priceLabel,selected,onSelect,currentPlan,busy,owner,onChoose,onUpgrade,onDiscover}:Props){
 const plan=plans[selected],business=plans.business;
 const specs=[
  {label:'Équipe',value:plan.members===1?'1 utilisateur':`${number(plan.members)} membres, propriétaire compris`,quantity:plan.members,max:business.members},
  {label:'Marques',value:`${number(plan.spaces)} espace${plan.spaces>1?'s de marques':' de marque'}`,quantity:plan.spaces,max:business.spaces},
  {label:'Projets',value:`${number(plan.projects)} projets actifs`,quantity:plan.projects,max:business.projects},
  {label:'Stockage',value:`${number(plan.storage/1024**3)} Go`,quantity:plan.storage,max:business.storage},
  {label:'Transfert',value:`${number(plan.transfer/1024**3)} Go`,quantity:plan.transfer,max:business.transfer},
  {label:'Navigateur et autonomie',value:selected==='essential'?'À partir de Pro':'Sous plafond approuvé',quantity:selected==='essential'?0:plan.concurrency,max:business.concurrency},
  {label:'Gouvernance',value:selected==='business'?'Rôles, budgets et validations':'—',quantity:selected==='business'?1:0,max:1},
 ];
 return <div className={styles.offers}>
  <div className={styles.toolbar}>
   {!paymentsEnabled&&<p className={styles.availability}><ShieldCheck size={16} aria-hidden="true"/>Les tarifs sont consultables. Les paiements ne sont pas encore ouverts.</p>}
   <div className={styles.period}><span>Pour 30 jours · renouvellement volontaire</span></div>
  </div>
  <section className={styles.instrument} aria-label="Comparer les forfaits">
   <div className={styles.stage}>
    <CreditInstrument credits={plan.credits} maximum={business.credits}/>
    <div className={styles.planSwitch} role="group" aria-label="Choisir un forfait à comparer">
     {PLAN_IDS.map(id=><button type="button" key={id} aria-pressed={selected===id} onClick={()=>onSelect(id)}><strong>{plans[id].name}</strong><span>{number(plans[id].periodPrice)} FCFA</span></button>)}
    </div>
   </div>
   <div className={styles.details}>
    <div className={styles.planIntro}><div><h2>{plan.name}</h2><span className={styles.planChip}>{currentPlan===selected?'Votre forfait':selected==='business'?'Pour une équipe':'Pour une marque'}</span></div><p>{selected==='essential'?'Discutez, rédigez et créez pour votre marque.':selected==='pro'?'Votre assistant pour créer et mener vos missions.':'Un solde partagé pour vos marques et votre équipe.'}</p></div>
    <div className={styles.priceBlock}><div className={styles.price}><strong>{number(plan.periodPrice)}</strong><span>FCFA</span></div><p>Pour 30 jours · {priceLabel}</p></div>
    <button type="button" className={styles.choose} disabled={busy||!owner} onClick={()=>onChoose(selected)}>{busy?'Préparation…':`${currentPlan===selected?'Renouveler':'Choisir'} ${plan.name}`}<ArrowUpRight size={17} aria-hidden="true"/></button>
    {!owner&&<p className={styles.ownerNote}>Seul le propriétaire de l’espace peut gérer les paiements.</p>}
    <div><dl className={styles.specs}>{specs.map(spec=><div key={spec.label}><div className={styles.specLine}><dt>{spec.label}</dt><dd>{spec.value}</dd></div><span className={styles.bar} aria-hidden="true"><span style={{width:`${spec.max>0?Math.min(100,spec.quantity/spec.max*100):0}%`}}/></span></div>)}</dl><p className={styles.comparisonNote}>Les barres comparent chaque ligne au forfait Business.</p></div>
    <p className={styles.annualNote}>Un seul solde pour la conversation, les créations et les outils. Les crédits du forfait expirent à la fin de la période.</p>
   </div>
  </section>
  {currentPlan&&PLAN_IDS.includes(currentPlan as PlanId)&&PLAN_IDS.indexOf(selected)>PLAN_IDS.indexOf(currentPlan as PlanId)&&<button type="button" className="button secondary" disabled={busy||!owner} onClick={()=>onUpgrade(selected)}>Passer à {plan.name} maintenant · voir le prorata<ArrowUpRight size={16}/></button>}
  <section className={styles.discovery} aria-labelledby="billing-discovery-title">
   <div className={styles.ticket}><strong>{number(free.credits)}</strong><span>crédits</span></div>
   <div className={styles.discoveryBody}><div><h2 id="billing-discovery-title">Commencez par une idée.</h2><p>Découverte : {number(free.credits)} crédits, une seule fois, valables {free.days} jours. Sans carte bancaire.</p></div><button type="button" className="button secondary" disabled={busy||!free.enabled} onClick={onDiscover}>{free.enabled?'Découvrir Aïra':'Découverte indisponible'}</button></div>
  </section>
  <section className={styles.explainer} aria-labelledby="billing-credits-title"><h2 id="billing-credits-title">Comment fonctionnent les crédits</h2><div className={styles.explainerGrid}>
   <article><span><SlidersVertical size={20} aria-hidden="true"/></span><div><h3>Un solde commun</h3><p>Conversation, créations, outils et missions utilisent les mêmes crédits. Les petits appels consomment des fractions de crédit.</p></div></article>
   <article><span><ShieldCheck size={20} aria-hidden="true"/></span><div><h3>Un plafond avant d’agir</h3><p>Aïra présente le plafond à approuver avant une génération ou une mission. Elle s’arrête au budget autorisé.</p></div></article>
   <article><span><Megaphone size={20} aria-hidden="true"/></span><div><h3>Publicité séparée</h3><p>Les dépenses publicitaires sont réglées directement à Meta, Google ou à la plateforme concernée.</p></div></article>
  </div><p className={styles.resultsNote}>Les exemples de résultats seront publiés après mesure des parcours.</p></section>
 </div>;
}
