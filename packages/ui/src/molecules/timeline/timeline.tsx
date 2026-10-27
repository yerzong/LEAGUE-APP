import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export interface TimelineItem {
  id: string;
  title: ReactNode;
  /** Who and when, already formatted by the app. */
  meta: ReactNode;
  description?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  /** Accessible name of the list (i18n from the app). */
  label: string;
  className?: string | undefined;
}

/** Vertical list of events, newest first (audit trail, history). */
export function Timeline({ items, label, className }: TimelineProps) {
  return (
    <ol aria-label={label} className={cn('flex flex-col', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < items.length - 1 && (
            <span
              aria-hidden
              className="absolute top-4 bottom-0 left-1.5 w-px -translate-x-1/2 bg-border"
            />
          )}
          <span
            aria-hidden
            className="mt-1 size-3 shrink-0 rounded-full border-2 border-primary bg-bg"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold text-text">{item.title}</p>
            <p className="text-xs text-text-muted">{item.meta}</p>
            {item.description && <div className="text-sm text-text-muted">{item.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
