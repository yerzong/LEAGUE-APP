import type { ComponentProps } from 'react';

import { cn } from '../../lib/cn.js';

/**
 * Premium accent surface (MVP card, live match panel, featured modal).
 * Do NOT use it for tables, page backgrounds, long lists or anything repeated
 * many times on screen: blur is expensive and lowers contrast.
 */
export function GlassPanel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="glass-panel"
      className={cn('glass rounded-md p-6 shadow-lg', className)}
      {...props}
    />
  );
}
