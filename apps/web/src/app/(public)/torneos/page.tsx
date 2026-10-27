import { format } from '@league/i18n';
import { Button, Card, CardContent, EmptyState, PageHeader, SectionHeading } from '@league/ui';
import { SearchXIcon, TrophyIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { listPublicTournaments } from '@/features/tournaments/api';
import { TournamentCard } from '@/features/tournaments/components/tournament-card';
import { filterHref, PUBLIC_FILTERS, readPublicFilter } from '@/features/tournaments/public-filter';

const t = messages.tournamentsPage;
const f = messages.tournaments.public.filters;
const description = format(t.description, { brand: brand.name });

export const metadata: Metadata = pageMetadata({ title: t.title, description, path: '/torneos' });

export default async function TournamentsPage({ searchParams }: PageProps<'/torneos'>) {
  const filter = readPublicFilter((await searchParams).estado);
  const result = await listPublicTournaments(filter, 1, 48);

  return (
    <PageContainer>
      <PageHeader title={t.title} description={description} />
      <nav aria-label={f.label} className="flex flex-wrap gap-2">
        {PUBLIC_FILTERS.map((item) => (
          <Button
            key={item.slug}
            asChild
            size="sm"
            variant={item.filter === filter ? 'primary' : 'outline'}
          >
            <Link
              href={filterHref(item.filter)}
              aria-current={item.filter === filter ? 'page' : undefined}
            >
              {f[item.filter]}
            </Link>
          </Button>
        ))}
      </nav>
      {!result.ok ? (
        <LoadError code={result.code} />
      ) : result.data.items.length === 0 ? (
        filter === 'all' ? (
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
        ) : (
          <EmptyState
            icon={<SearchXIcon />}
            title={messages.tournaments.public.emptyFiltered}
            action={
              <Button asChild variant="outline">
                <Link href="/torneos">{messages.tournaments.public.showAll}</Link>
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.items.map((tournament) => (
            <li key={tournament.slug}>
              <TournamentCard
                tournament={tournament}
                href={`/torneos/${tournament.slug}`}
                timeZone="America/Mexico_City"
              />
            </li>
          ))}
        </ul>
      )}
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
