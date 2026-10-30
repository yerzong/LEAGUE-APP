import * as React from 'react';

import { cn } from '../../lib/cn.js';

export interface BarListItem {
  readonly key: string;
  readonly label: React.ReactNode;
  readonly value: number;
  /** The value as shown (`4.2`, `61 %`). */
  readonly display: string;
  /** Leading visual (champion icon, avatar). */
  readonly media?: React.ReactNode;
  readonly hint?: React.ReactNode;
}

export interface BarListProps extends Omit<React.ComponentProps<'ol'>, 'children'> {
  readonly items: readonly BarListItem[];
  readonly label: string;
  /** The full bar; the largest value by default. */
  readonly max?: number;
}

/** Ranked horizontal bars (leaders, champions, rates). */
function BarList({ items, label, max, className, ...props }: BarListProps) {
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <ol
      data-slot="bar-list"
      aria-label={label}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      {items.map((item) => {
        const pct = top > 0 ? Math.max(0, Math.min(100, (item.value / top) * 100)) : 0;
        return (
          <li key={item.key} className="flex items-center gap-3">
            {item.media}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="tabular shrink-0 font-semibold">{item.display}</span>
              </div>
              <svg aria-hidden className="h-1.5 w-full" preserveAspectRatio="none">
                <rect width="100%" height="100%" rx={3} className="fill-surface-2" />
                <rect
                  data-bar
                  width={`${pct.toFixed(1)}%`}
                  height="100%"
                  rx={3}
                  className="fill-brand"
                />
              </svg>
              {item.hint && <span className="text-xs text-text-muted">{item.hint}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { BarList };
