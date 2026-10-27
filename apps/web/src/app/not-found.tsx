import { Button } from '@league/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { SiteFooter } from '@/features/site/components/site-footer';
import { SiteHeader } from '@/features/site/components/site-header';
import { StatusPage } from '@/features/site/components/status-page';

const t = messages.notFoundPage;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

// Rendered outside the (public) layout, so it brings its own header and footer.
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <StatusPage
          code="404"
          title={t.title}
          description={t.description}
          actions={
            <>
              <Button asChild>
                <Link href="/">{t.home}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/equipos">{t.explore}</Link>
              </Button>
            </>
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}
