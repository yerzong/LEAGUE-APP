import type { ReactNode } from 'react';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="font-display text-lg font-bold uppercase text-brand">{brand.name}</span>
        <span className="text-sm text-text-muted">{messages.zones.portal}</span>
      </header>
      <main className="flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
