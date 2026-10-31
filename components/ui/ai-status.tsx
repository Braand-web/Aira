'use client';

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import './ai-status.css';

export type AiStatusState = 'thinking' | 'researching' | 'analyzing' | 'writing' | 'done' | 'error' | 'cancelled';
export type AiStatusStateConfig = { label?: string | ((elapsed: string | undefined) => string); icon?: ReactNode; active?: boolean };
export type AiStatusProps = Omit<ComponentProps<'div'>, 'children'> & {
  state?: AiStatusState | (string & {});
  states?: Record<string, AiStatusStateConfig>;
  label?: string;
  detail?: string;
  icon?: ReactNode;
  favicon?: string | ReactNode;
  timer?: boolean;
  elapsed?: number;
  startedAt?: number;
  shimmer?: boolean;
};

const DEFAULT_STATES: Record<AiStatusState, AiStatusStateConfig> = {
  thinking: { label: 'Réponse en cours', active: true },
  researching: { label: 'Recherche en cours', active: true },
  analyzing: { label: 'Analyse en cours', active: true },
  writing: { label: 'Rédaction en cours', active: true },
  done: { label: time => time ? `Terminé en ${time}` : 'Terminé', active: false },
  error: { label: 'Réponse interrompue', active: false },
  cancelled: { label: 'Arrêt demandé', active: false },
};
const formatElapsed = (seconds: number) => seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;

/** State comes from the stream, never a scripted sequence of pretend actions. */
export function AiStatus({ state = 'thinking', states, label, detail, icon, favicon, timer = true, elapsed, startedAt: runStartedAt, shimmer, className, ...props }: AiStatusProps) {
  const config = { ...(Object.hasOwn(DEFAULT_STATES, state) ? DEFAULT_STATES[state as AiStatusState] : {}), ...states?.[state] };
  const active = config.active ?? true;
  const [counted, setCounted] = useState<number>();
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number | null>(null);
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) { startedAt.current = runStartedAt ?? Date.now(); setCounted(Math.max(0,Math.floor((Date.now()-startedAt.current)/1000))); }
    wasActive.current = active;
    if (!active || !timer || elapsed !== undefined) {
      if (startedAt.current !== null) setCounted(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000)));
      return;
    }
    const tick = () => { if (!document.hidden && startedAt.current !== null) setCounted(Math.max(0, Math.floor((Date.now() - startedAt.current) / 1000))); };
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [active, timer, elapsed, runStartedAt]);
  useEffect(() => {
    let inView = true;
    const sync = () => setPaused(document.hidden || !inView);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {inView=entry.isIntersecting;sync();}) : null;
    if(root.current) observer?.observe(root.current);
    sync(); document.addEventListener('visibilitychange', sync);
    return () => {observer?.disconnect();document.removeEventListener('visibilitychange', sync);};
  }, []);
  const seconds = elapsed ?? counted;
  const time = timer && seconds !== undefined && Number.isFinite(seconds) ? formatElapsed(Math.max(0, Math.floor(seconds))) : undefined;
  const text = label ?? (typeof config.label === 'function' ? config.label(time) : config.label ?? 'Traitement en cours');
  return <div ref={root} data-slot="ai-status" data-state={state} data-active={active || undefined} data-paused={paused || undefined} className={cn('ai-status', className)} {...props}>
    <span className="ai-status-icon" key={state} aria-hidden="true">{icon ?? config.icon ?? <AiStatusIcon state={state}/>}</span>
    <span className="ai-status-content">
      <span className={cn('ai-status-label', (shimmer ?? active) && 'ai-status-shimmer')} key={text} role="status" aria-live="polite" aria-atomic="true">{text}{detail && <span className="ai-status-sr"> · {detail}</span>}</span>
      {detail && <span className="ai-status-detail" title={detail} aria-hidden="true">{typeof favicon === 'string' ? <Image src={favicon} alt="" width={14} height={14} unoptimized/> : favicon}{detail}</span>}
      {active && time && <span className="ai-status-timer" aria-hidden="true">{time}</span>}
    </span>
  </div>;
}

export function AiStatusIcon({ state }: { state: AiStatusState | (string & {}) }) {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {state === 'thinking' ? <><path className="ai-status-sparkle" fill="currentColor" stroke="none" d="M11 5Q12 12 19 13Q12 14 11 21Q10 14 3 13Q10 12 11 5Z"/><path className="ai-status-twinkle" fill="currentColor" stroke="none" d="M18 2Q18.4 4.6 21 5Q18.4 5.4 18 8Q17.6 5.4 15 5Q17.6 4.6 18 2Z"/></> :
      state === 'researching' ? <g className="ai-status-search"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m14.75 14.75 4.25 4.25"/></g> :
      state === 'analyzing' ? <g className="ai-status-bars">{[6,12,18].map((x,i)=><path key={x} d={`M${x} 6v13`} style={{animationDelay:`${i * 150}ms`}} strokeWidth="2.6"/>)}</g> :
      state === 'writing' ? <><path className="ai-status-ink" d="M3 19c1.1-2.7 2.1-2.7 3.2 0s2.1 2.7 3.2 0 2.1-2.7 3.2 0" pathLength="1"/><path className="ai-status-pen" d="m8 15 1-4L18 2l4 4-9 9-4 1Z"/></> :
      state === 'done' ? <path className="ai-status-check" d="m5 12.5 5 5 9-10.5" pathLength="1"/> :
      state === 'error' ? <><circle cx="12" cy="12" r="8"/><path d="M12 8v5m0 3h.01"/></> :
      state === 'cancelled' ? <><path d="M8 6v12m8-12v12"/></> : <circle className="ai-status-twinkle" cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>}
  </svg>;
}
export default AiStatus;
