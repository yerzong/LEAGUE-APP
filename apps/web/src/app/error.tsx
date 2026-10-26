'use client';

import { ErrorView } from '@/features/site/components/error-view';

/** /app and /admin: the zone shell stays when its layout rendered. */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <ErrorView reset={reset} />
    </main>
  );
}
