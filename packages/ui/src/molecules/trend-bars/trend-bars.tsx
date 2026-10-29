import * as React from 'react';

import { cn } from '../../lib/cn.js';

export interface TrendPoint {
  readonly key: string;
  /** Short label under the bar (a date). */
  readonly label: string;
  readonly value: number;
  readonly display: string;
}

export interface TrendBarsProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  readonly points: readonly TrendPoint[];
  readonly label: string;
}

const HEIGHT = 96;

/** Vertical bars over time (weekly evolution); each bar carries its value. */
function TrendBars({ points, label, className, ...props }: TrendBarsProps) {
  const top = Math.max(0, ...points.map((p) => p.value));
  return (
    <figure data-slot="trend-bars" className={cn('flex flex-col gap-2', className)} {...props}>
      <ol aria-label={label} className="flex items-end gap-2">
        {points.map((p) => {
          const h = top > 0 ? Math.max(4, (p.value / top) * HEIGHT) : 4;
          return (
            <li key={p.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="tabular text-xs font-semibold">{p.display}</span>
              <svg
                aria-hidden
                viewBox={`0 0 10 ${String(HEIGHT)}`}
                preserveAspectRatio="none"
                className="h-24 w-full max-w-10"
              >
                <rect
                  data-bar
                  x={0}
                  y={HEIGHT - h}
                  width={10}
                  height={h}
                  rx={1.5}
                  className="fill-brand"
                />
              </svg>
              <span className="truncate text-xs text-text-muted">{p.label}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

export { TrendBars };
