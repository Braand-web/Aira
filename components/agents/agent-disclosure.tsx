'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function AgentDisclosure({ open, children, className, ...props }: ComponentProps<'div'> & { open: boolean }) {
  return <div {...props} className={cn('response-disclosure', className)} data-open={open} aria-hidden={!open} inert={!open}>
    <div className="response-disclosure-inner">{children}</div>
  </div>;
}
