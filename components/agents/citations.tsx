'use client';

import { FileText, Globe2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CitationItem {
  id: string;
  title: ReactNode;
  domain?: ReactNode;
  url?: string;
  icon?: ReactNode;
}

/** Sources are untrusted: only explicit web URLs can become links. */
export function citationUrl(value?: string) {
  if (!value || !/^https?:\/\//i.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url;
  } catch { return undefined; }
}

export function CitationStack({ citations, limit = 3, className }: { citations: CitationItem[]; limit?: number; className?: string }) {
  return <span className={cn('response-citation-stack', className)} aria-hidden="true">
    {citations.slice(0, Math.max(0, limit)).map((source, index) => <span className="response-citation-symbol" key={`${source.id}-${index}`}>
      {source.icon ?? (citationUrl(source.url) ? <Globe2 /> : <FileText />)}
    </span>)}
  </span>;
}

export function CitationList({ citations, idPrefix = 'response-source', className }: { citations: CitationItem[]; idPrefix?: string; className?: string }) {
  return <ol className={cn('response-citation-list', className)} aria-label="Sources de la réponse">
    {citations.map((source, index) => {
      const url = citationUrl(source.url);
      const content = <><span className="response-citation-number" aria-hidden="true">{index + 1}</span><span className="response-citation-text"><span className="response-citation-title">{source.title}</span><span className="response-citation-domain">{url ? url.hostname : source.domain ?? 'Document joint'}</span></span></>;
      return <li id={`${idPrefix}-${index + 1}`} key={`${source.id}-${index}`}>
        {url ? <a href={url.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{content}<span className="sr-only"> (nouvel onglet)</span></a> : <div className="response-citation-document">{content}</div>}
      </li>;
    })}
  </ol>;
}
