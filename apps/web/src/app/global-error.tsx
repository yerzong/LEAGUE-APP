'use client';

import './globals.css';

import { locale } from '@/config/i18n';
import { ErrorView } from '@/features/site/components/error-view';

// Last resort when the root layout itself fails: it must render <html>.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ErrorView reset={reset} />
      </body>
    </html>
  );
}
