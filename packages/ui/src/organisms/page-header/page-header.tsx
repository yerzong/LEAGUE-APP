import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export interface PageHeaderProps {
  title: string;
  /** Small label above the title (section, circuit...). */
  eyebrow?: string | undefined;
  description?: string | undefined;
  /** Primary actions, aligned to the end on wide screens. */
  actions?: ReactNode;
  className?: string | undefined;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {eyebrow && <p className="text-xs font-semibold text-brand-dim caps">{eyebrow}</p>}
        <h1 className="font-display text-3xl leading-none font-extrabold text-brand caps">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
