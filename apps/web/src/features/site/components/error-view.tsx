'use client';

import { Button } from '@league/ui';
import Link from 'next/link';

import { messages } from '@/config/i18n';

import { StatusPage } from './status-page';

const t = messages.errorPage;

/** Body of the error boundaries: retry or go home, never a dead end. */
export function ErrorView({ reset }: { reset: () => void }) {
  return (
    <StatusPage
      code="500"
      title={t.title}
      description={t.description}
      actions={
        <>
          <Button onClick={reset}>{t.retry}</Button>
          <Button asChild variant="outline">
            <Link href="/">{t.home}</Link>
          </Button>
        </>
      }
    />
  );
}
