import { format } from '@league/i18n';
import { Breadcrumbs, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { messages } from '@/config/i18n';
import { getPublicMatch } from '@/features/competition/api';
import { LiveRefresh } from '@/features/competition/components/live-refresh';
import { MatchHeader } from '@/features/competition/components/match-header';
import { LoadError } from '@/features/shell/load-error';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { getMatchStats } from '@/features/stats/api';
import { MatchBoxScore } from '@/features/stats/components/match-box-score';
import { renderRouterLink } from '@/lib/ui/router-link';

const c = messages.competition;
const loadMatch = cache(getPublicMatch);

const titleOf = (m: {
  entrantA: { displayName: string } | null;
  entrantB: { displayName: string } | null;
}) =>
  format(c.detail.title, {
    a: m.entrantA?.displayName ?? c.slot.tbd,
    b: m.entrantB?.displayName ?? c.slot.tbd,
  });

export async function generateMetadata({
  params,
}: PageProps<'/torneos/[slug]/partidas/[id]'>): Promise<Metadata> {
  const { slug, id } = await params;
  const result = await loadMatch(id);
  if (!result.ok || result.data.tournament.slug !== slug)
    return { title: messages.errors.match_not_found, robots: { index: false } };
  const match = result.data;
  return pageMetadata({
    title: `${titleOf(match)} · ${match.tournament.name}`,
    description: `${match.phaseName} · ${c.statuses[match.status]}`,
    path: `/torneos/${slug}/partidas/${id}`,
  });
}

export default async function PublicMatchPage({
  params,
}: PageProps<'/torneos/[slug]/partidas/[id]'>) {
  const { slug, id } = await params;
  const [result, stats] = await Promise.all([loadMatch(id), getMatchStats(id)]);
  if (!result.ok) {
    if (result.code === 'match_not_found' || result.code === 'validation_failed') notFound();
    return <LoadError code={result.code} />;
  }
  const match = result.data;
  if (match.tournament.slug !== slug) notFound();

  return (
    <PageContainer>
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.breadcrumbs.home, href: '/' },
          { label: messages.publicNav.tournaments, href: '/torneos' },
          { label: match.tournament.name, href: `/torneos/${slug}` },
          { label: titleOf(match) },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader
        title={titleOf(match)}
        eyebrow={match.phaseName}
        actions={<LiveRefresh tournamentId={match.tournament.id} />}
      />
      <MatchHeader match={match} />
      {stats.ok && (
        <MatchBoxScore
          stats={stats.data}
          names={
            new Map(
              [match.entrantA, match.entrantB].flatMap((e) => (e ? [[e.id, e.displayName]] : [])),
            )
          }
        />
      )}
    </PageContainer>
  );
}
