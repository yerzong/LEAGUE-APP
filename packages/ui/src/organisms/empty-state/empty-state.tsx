import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';

export interface StateMessageProps {
  title: string;
  description?: string | undefined;
  icon?: ReactNode;
  /** Call to action (create the first item, retry...). */
  action?: ReactNode;
  className?: string | undefined;
}

export interface EmptyStateProps extends StateMessageProps {
  /**
   * `showcase`: public pages whose content is on its way. Reads as intentional
   * ("coming soon"), not as a missing or broken block.
   */
  variant?: 'default' | 'showcase' | undefined;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  variant = 'default',
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-md px-6 py-12 text-center',
        variant === 'showcase'
          ? 'relative isolate overflow-hidden border border-border bg-surface'
          : 'border border-dashed border-border',
        className,
      )}
    >
      {variant === 'showcase' && (
        <div aria-hidden className="absolute inset-0 -z-10 opacity-60 hero-grid" />
      )}
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-sm border bg-surface-2 text-brand-dim [&_svg]:size-6">
          {icon}
        </div>
      )}
      <p className="font-display text-lg font-bold text-text caps">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
