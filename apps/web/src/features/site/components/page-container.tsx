import { cn } from '@league/ui';
import type { ReactNode } from 'react';

/** Content width of the public site (matches the header and footer). */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10', className)}>
      {children}
    </div>
  );
}
