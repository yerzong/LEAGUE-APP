import { format } from '@league/i18n';
import { Breadcrumbs, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { getMatch } from '@/features/competition/api';
import { LiveRefresh } from '@/features/competition/components/live-refresh';
import { MatchHeader, MatchRecords } from '@/features/competition/components/match-header';
import { StaffMatchPanel } from '@/features/competition/components/staff-match-panel';
import { LoadError } from '@/features/shell/load-error';
import { getMatchDataStatus } from '@/features/stats/api';
import { MatchDataPanel } from '@/features/stats/components/admin/match-data-panel';
import { renderRouterLink } from '@/lib/ui/router-link';

const c = messages.competition;

export const metadata: Metadata = { title: c.admin.manage };

export default async function AdminMatchPage({
  params,
}: PageProps<'/admin/torneos/[id]/partidas/[matchId]'>) {
  const { id, matchId } = await params;
  const [result, dataStatus] = await Promise.all([getMatch(matchId), getMatchDataStatus(matchId)]);
  if (!result.ok) {
    if (result.code === 'match_not_found' || result.code === 'validation_failed') notFound();
    return <LoadError code={result.code} />;
  }
  const match = result.data;
  if (match.tournament.id !== id) notFound();
  const title = format(c.detail.title, {
    a: match.entrantA?.displayName ?? c.slot.tbd,
    b: match.entrantB?.displayName ?? c.slot.tbd,
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.tournaments.tracking.backToList, href: '/admin/torneos' },
          { label: match.tournament.name, href: `/admin/torneos/${id}?tab=matches` },
          { label: title },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader
        title={title}
        eyebrow={match.phaseName}
        actions={<LiveRefresh tournamentId={id} />}
      />
      <MatchHeader match={match} />
      <StaffMatchPanel match={match} />
      {dataStatus.ok && <MatchDataPanel status={dataStatus.data} />}
      <MatchRecords match={match} />
    </div>
  );
}
