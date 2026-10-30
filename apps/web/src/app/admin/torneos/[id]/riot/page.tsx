import { Breadcrumbs, PageHeader, SectionHeading } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { getAdminBoard } from '@/features/competition/api';
import { FINISHED_STATUSES } from '@/features/competition/format';
import { getAdminMatchCodes, getRiotStatus } from '@/features/riot-tournament/api';
import {
  MatchCodeManager,
  type MatchRow,
} from '@/features/riot-tournament/components/match-code-manager';
import { RiotStatusPanel } from '@/features/riot-tournament/components/riot-status-panel';
import { getAdminTournament } from '@/features/tournaments/api';
import { LoadError } from '@/features/shell/load-error';
import { renderRouterLink } from '@/lib/ui/router-link';

const r = messages.riotTournament;

export const metadata: Metadata = { title: r.title };

export default async function AdminTournamentRiotPage({
  params,
}: PageProps<'/admin/torneos/[id]/riot'>) {
  const { id } = await params;
  const [tournament, status, board] = await Promise.all([
    getAdminTournament(id),
    getRiotStatus(id),
    getAdminBoard(id),
  ]);
  if (!tournament.ok) return <LoadError code={tournament.code} />;
  if (!status.ok) return <LoadError code={status.code} />;

  const playable = board.ok
    ? board.data.phases
        .flatMap((phase) => phase.matches)
        .filter((m) => m.entrantA && m.entrantB && !FINISHED_STATUSES.has(m.status))
    : [];
  const codeResults = await Promise.all(playable.map((m) => getAdminMatchCodes(m.id)));
  const matches: MatchRow[] = playable.map((m, i) => {
    const codes = codeResults[i];
    return {
      id: m.id,
      label: `${m.entrantA?.displayName ?? ''} vs ${m.entrantB?.displayName ?? ''}`,
      codes: codes?.ok ? codes.data.codes : [],
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.shell.nav.adminTournaments, href: '/admin/torneos' },
          { label: tournament.data.name, href: `/admin/torneos/${id}` },
          { label: r.title },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader title={r.title} description={r.description} />
      <RiotStatusPanel tournamentId={id} status={status.data} />
      {status.data.connected && (
        <section className="flex flex-col gap-3">
          <SectionHeading title={r.codes.generate} />
          <MatchCodeManager tournamentId={id} matches={matches} />
        </section>
      )}
    </div>
  );
}
