// Competition tabs of the event page (docs/14 §3.3): phases and bracket,
// calendar, matches and standings, on top of the board of the API.
import type { TournamentBoard, TournamentDetail } from '@league/contracts';
import { EmptyState } from '@league/ui';
import { ListOrderedIcon } from 'lucide-react';

import { messages } from '@/config/i18n';
import { CalendarPanel, PhasesPanel } from '@/features/tournaments/tracking/tracking-panels';

import { AutoScheduleButton, GenerateFixturesButton } from './board-actions';
import { BoardView, MatchList, Tables } from './board-view';

const c = messages.competition;
const base = (id: string) => `/admin/torneos/${id}/partidas`;

const hasMatches = (board: TournamentBoard) => board.phases.some((p) => p.matches.length > 0);

export function CompetitionPhasesPanel({
  detail,
  board,
}: {
  detail: TournamentDetail;
  board: TournamentBoard;
}) {
  if (!hasMatches(board))
    return (
      <>
        <GenerateFixturesButton tournamentId={detail.id} enabled={board.canGenerateFixtures} />
        <PhasesPanel detail={detail} />
      </>
    );
  return <BoardView board={board} matchBase={base(detail.id)} />;
}

export function CompetitionCalendarPanel({
  detail,
  board,
}: {
  detail: TournamentDetail;
  board: TournamentBoard;
}) {
  const all = board.phases
    .flatMap((p) => p.matches)
    .sort(
      (a, b) =>
        (a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER) -
          (b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER) ||
        a.round - b.round,
    );
  return (
    <>
      {all.length > 0 && <AutoScheduleButton tournamentId={detail.id} />}
      <CalendarPanel detail={detail} />
      {all.length > 0 && (
        <section className="flex flex-col gap-2" aria-label={c.board.calendar}>
          <h2 className="font-display text-lg font-bold text-text caps">{c.board.calendar}</h2>
          <MatchList
            matches={all}
            phase={undefined}
            matchBase={base(detail.id)}
            timeZone={board.timezone}
          />
        </section>
      )}
    </>
  );
}

export function CompetitionMatchesPanel({
  detail,
  board,
}: {
  detail: TournamentDetail;
  board: TournamentBoard;
}) {
  if (!hasMatches(board)) return <EmptyState title={c.board.empty} />;
  return (
    <>
      {board.phases
        .filter((p) => p.matches.length > 0)
        .map((phase) => (
          <section key={phase.id} className="flex flex-col gap-2" aria-label={phase.name}>
            <h2 className="font-display text-lg font-bold text-text caps">
              {phase.position}. {phase.name}
            </h2>
            <MatchList
              matches={phase.matches}
              phase={phase}
              matchBase={base(detail.id)}
              timeZone={board.timezone}
            />
          </section>
        ))}
    </>
  );
}

export function CompetitionStandingsPanel({ board }: { board: TournamentBoard }) {
  const phases = board.phases.filter((p) => p.groups.some((g) => g.standings.length > 0));
  if (phases.length === 0) return <EmptyState icon={<ListOrderedIcon />} title={c.board.empty} />;
  return (
    <>
      {phases.map((phase) => (
        <section key={phase.id} className="flex flex-col gap-2" aria-label={phase.name}>
          <h2 className="font-display text-lg font-bold text-text caps">
            {phase.position}. {phase.name}
          </h2>
          <Tables phase={phase} />
        </section>
      ))}
    </>
  );
}
