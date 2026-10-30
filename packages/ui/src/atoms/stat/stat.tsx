import * as React from 'react';

import { cn } from '../../lib/cn.js';

export interface StatProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  readonly label: React.ReactNode;
  readonly value: React.ReactNode;
  readonly hint?: React.ReactNode;
}

/** One number with its label (KDA, CS/min, winrate…). */
function Stat({ label, value, hint, className, ...props }: StatProps) {
  return (
    <div
      data-slot="stat"
      className={cn(
        'flex flex-col gap-1 rounded-md border border-border bg-surface p-3',
        className,
      )}
      {...props}
    >
      <dt className="caps text-xs text-text-muted">{label}</dt>
      <dd className="tabular font-display text-2xl leading-none">{value}</dd>
      {hint && <dd className="text-xs text-text-muted">{hint}</dd>}
    </div>
  );
}

/** A responsive grid of Stat. */
function StatGrid({ className, ...props }: React.ComponentProps<'dl'>) {
  return (
    <dl
      data-slot="stat-grid"
      className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}
      {...props}
    />
  );
}

export { Stat, StatGrid };
