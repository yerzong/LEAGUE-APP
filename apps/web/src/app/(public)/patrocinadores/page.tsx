import { Button, Card, CardContent, PageHeader } from '@league/ui';
import { CheckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { publicEnv } from '@/config/public-env';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';

const t = messages.sponsorPage;

export const metadata: Metadata = pageMetadata({
  title: t.title,
  description: t.description,
  path: '/patrocinadores',
});

export default function SponsorPage() {
  const email = publicEnv.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />
      <Card>
        <CardContent className="flex flex-col gap-6">
          <ul className="flex flex-col gap-3">
            {t.points.map((point) => (
              <li key={point} className="flex gap-3 text-text">
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                {point}
              </li>
            ))}
          </ul>
          {email ? (
            <div>
              <Button asChild>
                <a href={`mailto:${email}`}>{t.contact}</a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t.noContact}</p>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/equipos">{messages.home.hero.browseTeams}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/torneos">{messages.home.hero.explore}</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
