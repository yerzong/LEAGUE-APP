import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export interface SectionHeadingProps {
  title: string;
  /** Small label above the title. */
  eyebrow?: string | undefined;
  description?: string | undefined;
  /** "See all" link or similar, aligned to the end on wide screens. */
  action?: ReactNode;
  /** Lets the section point `aria-labelledby` at the title. */
  id?: string | undefined;
  className?: string | undefined;
}

/** Title block of a page section (h2). */
export function SectionHeading({
  title,
  eyebrow,
  description,
  action,
  id,
  className,
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="flex flex-col gap-2">
        {eyebrow && (
          <p className="flex items-center gap-2 text-xs font-semibold text-brand-dim caps">
            <span aria-hidden className="h-px w-6 bg-brand-dim" />
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="font-display text-2xl leading-none font-extrabold text-text caps">
          {title}
        </h2>
        {description && <p className="max-w-2xl text-text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
