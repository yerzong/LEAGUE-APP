import { format } from '@league/i18n';
import { Breadcrumbs, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { getMatch } from '@/features/competition/api';
import { LiveRefresh } from '@/features/competition/components/live-refresh';
import { MatchCenter } from '@/features/competition/components/match-center';
import { MatchHeader, MatchRecords } from '@/features/competition/components/match-header';
import { LoadError } from '@/features/shell/load-error';
import { renderRouterLink } from '@/lib/ui/router-link';

const c = messages.competition;

export const metadata: Metadata = { title: c.portal.title };

export default async function MatchCenterPage({ params }: PageProps<'/app/partidas/[id]'>) {
  const { id } = await params;
  const result = await getMatch(id);
  if (!result.ok) {
    if (result.code === 'match_not_found' || result.code === 'validation_failed') notFound();
    return <LoadError code={result.code} />;
  }
  const match = result.data;
  const title = format(c.detail.title, {
    a: match.entrantA?.displayName ?? c.slot.tbd,
    b: match.entrantB?.displayName ?? c.slot.tbd,
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[{ label: c.portal.title, href: '/app/partidas' }, { label: title }]}
        renderLink={renderRouterLink}
      />
      <PageHeader
        title={title}
        eyebrow={match.tournament.name}
        actions={<LiveRefresh tournamentId={match.tournament.id} />}
      />
      <MatchHeader match={match} />
      <MatchCenter match={match} />
      {match.permissions && <MatchRecords match={match} />}
    </div>
  );
}
