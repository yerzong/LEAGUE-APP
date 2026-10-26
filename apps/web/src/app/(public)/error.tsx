'use client';

import { ErrorView } from '@/features/site/components/error-view';

// Inside the public layout: header and footer stay, only the page is replaced.
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorView reset={reset} />;
}
