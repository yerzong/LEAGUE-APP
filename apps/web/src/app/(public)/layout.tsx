import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/site/components/site-footer';
import { SiteHeader } from '@/features/site/components/site-header';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
