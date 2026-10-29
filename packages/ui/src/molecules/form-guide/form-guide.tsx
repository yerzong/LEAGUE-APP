import * as React from 'react';

import { cn } from '../../lib/cn.js';

export type FormGuideResult = 'win' | 'loss';

export interface FormGuideProps extends Omit<React.ComponentProps<'ol'>, 'children' | 'results'> {
  /** Newest first. */
  readonly results: readonly FormGuideResult[];
  readonly label: string;
  /** Letter and accessible name of each result (`V` / `Victoria`). */
  readonly labels: Readonly<Record<FormGuideResult, { short: string; long: string }>>;
}

/** Recent form: a strip of wins and losses, newest first. */
function FormGuide({ results, label, labels, className, ...props }: FormGuideProps) {
  return (
    <ol
      data-slot="form-guide"
      aria-label={label}
      className={cn('flex gap-1', className)}
      {...props}
    >
      {results.map((r, i) => (
        <li
          key={i}
          aria-label={labels[r].long}
          className={cn(
            'flex size-6 items-center justify-center rounded-xs border text-xs font-semibold',
            r === 'win'
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-danger/40 bg-danger/10 text-danger',
          )}
        >
          {labels[r].short}
        </li>
      ))}
    </ol>
  );
}

export { FormGuide };
