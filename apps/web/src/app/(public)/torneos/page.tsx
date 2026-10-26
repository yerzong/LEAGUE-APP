import { format } from '@league/i18n';
import { Button, Card, CardContent, EmptyState, PageHeader, SectionHeading } from '@league/ui';
import { TrophyIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';

const t = messages.tournamentsPage;
const description = format(t.description, { brand: brand.name });

export const metadata: Metadata = pageMetadata({ title: t.title, description, path: '/torneos' });

// Structure ready for the tournaments module: until it exists, an empty
// state and how competition is organized (docs/02-formatos-competencia.md).
export default function TournamentsPage() {
  return (
    <PageContainer>
      <PageHeader title={t.title} description={description} />
      <EmptyState
        variant="showcase"
        icon={<TrophyIcon />}
        title={t.emptyTitle}
        description={t.emptyDescription}
        action={
          <Button asChild variant="outline">
            <Link href="/app">{t.emptyAction}</Link>
          </Button>
        }
      />
      <section aria-labelledby="tournament-types" className="flex flex-col gap-6">
        <SectionHeading
          id="tournament-types"
          title={t.typesTitle}
          description={t.typesDescription}
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {t.types.map((type) => (
            <li key={type.name}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-2">
                  <h3 className="font-display text-xl font-bold text-text caps">{type.name}</h3>
                  <p className="text-text">{type.summary}</p>
                  <p className="text-sm text-text-muted">{type.detail}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
