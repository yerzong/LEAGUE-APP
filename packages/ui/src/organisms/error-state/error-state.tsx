import { TriangleAlertIcon } from 'lucide-react';

import { cn } from '../../lib/cn.js';
import type { StateMessageProps } from '../empty-state/empty-state.js';

export type ErrorStateProps = Omit<StateMessageProps, 'icon'>;

/** Failure to load something. Always icon + text, never color alone (danger ≈ red side). */
export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-6 py-12 text-center',
        className,
      )}
    >
      <TriangleAlertIcon aria-hidden="true" className="size-8 text-danger" />
      <p className="font-display text-lg font-bold text-text caps">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
