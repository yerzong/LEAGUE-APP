// The board of a tournament (bracket, tables, calendar and results), the same
// in the public page, the portal and the console. Presentational: it receives
// the board and how to link a match.
import type { MatchSummary, PhaseBoard, TournamentBoard } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Badge,
  Bracket,
  type BracketRound,
  EmptyState,
  StandingsTable,
  type StandingsRow,
} from '@league/ui';
import { GitForkIcon, TrophyIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { formatDateTime } from '@/features/tournaments/format';
import { renderRouterLink } from '@/lib/ui/router-link';

import {
  FINISHED_STATUSES,
  LIVE_STATUSES,
  MATCH_STATUS_VARIANT,
  matchLabel,
  roundTitle,
  signed,
  slotName,
  tiebreakNote,
} from '../format';

const c = messages.competition;
const ELIMINATION = new Set(['single_elimination', 'double_elimination']);

export interface BoardViewProps {
  board: TournamentBoard;
  /** Base path of match pages (`/torneos/x/partidas`): `${base}/${id}`. */
  matchBase: string;
}

function matchMeta(m: MatchSummary, timeZone: string) {
  if (FINISHED_STATUSES.has(m.status) || LIVE_STATUSES.has(m.status) || m.status === 'disputed')
    return c.statuses[m.status];
  return m.scheduledAt ? formatDateTime(m.scheduledAt, timeZone) : c.board.noSchedule;
}

function bracketRounds(
  phase: PhaseBoard,
  matchBase: string,
  timeZone: string,
): { side: string | null; rounds: BracketRound[] }[] {
  const sides = [...new Set(phase.matches.map((m) => m.bracketSide))];
  return sides.map((side) => {
    const matches = phase.matches.filter((m) => m.bracketSide === side);
    const last = Math.max(
      ...matches.filter((m) => m.bracketKey !== 'third-place').map((m) => m.round),
    );
    const titles = new Map<string, { title: string; matches: MatchSummary[] }>();
    for (const m of matches) {
      const title = roundTitle(phase, m, last);
      const key = `${String(m.round)}-${title}`;
      titles.set(key, { title, matches: [...(titles.get(key)?.matches ?? []), m] });
    }
    return {
      side,
      rounds: [...titles.entries()].map(([id, { title, matches: list }]) => ({
        id,
        title,
        matches: list.map((m) => ({
          id: m.id,
          href: `${matchBase}/${m.id}`,
          live: LIVE_STATUSES.has(m.status),
          meta: matchMeta(m, timeZone),
          a: m.entrantA
            ? {
                name: m.entrantA.displayName,
                tag: m.entrantA.displayTag ?? undefined,
                score: FINISHED_STATUSES.has(m.status) ? m.scoreA : undefined,
                winner: m.winnerId !== null && m.winnerId === m.entrantA.id,
              }
            : { name: slotName(phase.matches, m.sourceA), placeholder: true },
          b: m.entrantB
            ? {
                name: m.entrantB.displayName,
                tag: m.entrantB.displayTag ?? undefined,
                score: FINISHED_STATUSES.has(m.status) ? m.scoreB : undefined,
                winner: m.winnerId !== null && m.winnerId === m.entrantB.id,
              }
            : { name: slotName(phase.matches, m.sourceB), placeholder: true },
        })),
      })),
    };
  });
}

const columns = [
  { key: 'played', label: c.table.played, title: c.table.playedTitle },
  { key: 'wins', label: c.table.wins, title: c.table.winsTitle },
  { key: 'draws', label: c.table.draws, title: c.table.drawsTitle },
  { key: 'losses', label: c.table.losses, title: c.table.lossesTitle },
  { key: 'games', label: c.table.games, title: c.table.gamesTitle },
  { key: 'diff', label: c.table.diff, title: c.table.diffTitle },
  { key: 'points', label: c.table.points, title: c.table.pointsTitle },
];

export function Tables({ phase }: { phase: PhaseBoard }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {phase.groups.map((group) => {
        const rows: StandingsRow[] = group.standings.map((row) => ({
          id: row.entrant.id,
          rank: row.rank,
          entrant: row.entrant.teamSlug ? (
            <Link
              href={`/equipos/${row.entrant.teamSlug}`}
              className="font-semibold text-text hover:text-brand"
            >
              {row.entrant.displayName}
            </Link>
          ) : (
            <span className="font-semibold text-text">{row.entrant.displayName}</span>
          ),
          values: [
            row.played,
            row.wins,
            row.draws,
            row.losses,
            `${String(row.gameWins)}-${String(row.gameLosses)}`,
            signed(row.gameDiff),
            row.points,
          ],
          status:
            row.status === 'in_contention' ? undefined : (
              <Badge variant={row.status === 'qualified' ? 'success' : 'outline'}>
                {c.standingStatuses[row.status]}
              </Badge>
            ),
          note: tiebreakNote(row) ?? undefined,
          highlight: row.status === 'in_contention' ? undefined : row.status,
        }));
        const caption = group.name ? format(c.group, { name: group.name }) : phase.name;
        return (
          <div key={group.id ?? 'all'} className="flex flex-col gap-2">
            {group.name && <h4 className="text-sm text-text-muted caps">{caption}</h4>}
            <StandingsTable
              caption={caption}
              rankLabel={c.table.rank}
              entrantLabel={c.table.entrant}
              columns={columns}
              rows={rows}
            />
          </div>
        );
      })}
    </div>
  );
}

export function MatchList({
  matches,
  phase,
  matchBase,
  timeZone,
}: {
  matches: readonly MatchSummary[];
  phase: PhaseBoard | undefined;
  matchBase: string;
  timeZone: string;
}) {
  if (matches.length === 0) return <p className="text-sm text-text-muted">{c.board.noMatches}</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
      {matches.map((m) => {
        const a =
          m.entrantA?.displayName ?? (phase ? slotName(phase.matches, m.sourceA) : c.slot.tbd);
        const b =
          m.entrantB?.displayName ?? (phase ? slotName(phase.matches, m.sourceB) : c.slot.tbd);
        return (
          <li key={m.id}>
            <Link
              href={`${matchBase}/${m.id}`}
              className="focus-ring grid items-center gap-2 px-3 py-2 hover:bg-surface-2 sm:grid-cols-6"
            >
              <span className="text-xs text-text-muted sm:col-span-1">
                {m.groupName ? `${format(c.group, { name: m.groupName })} · ` : ''}
                {matchLabel(m)}
              </span>
              <span className="text-sm text-text sm:col-span-3">
                <span
                  className={m.winnerId && m.winnerId === m.entrantA?.id ? 'font-semibold' : ''}
                >
                  {a}
                </span>{' '}
                {FINISHED_STATUSES.has(m.status) ? (
                  <span className="tabular text-text-muted">
                    {format(c.board.score, { a: m.scoreA, b: m.scoreB })}
                  </span>
                ) : (
                  <span className="text-text-muted">{c.vs}</span>
                )}{' '}
                <span
                  className={m.winnerId && m.winnerId === m.entrantB?.id ? 'font-semibold' : ''}
                >
                  {b}
                </span>
              </span>
              <span className="text-xs text-text-muted sm:col-span-1">
                {m.scheduledAt ? formatDateTime(m.scheduledAt, timeZone) : c.board.noSchedule}
              </span>
              <span className="sm:col-span-1 sm:text-right">
                <Badge variant={MATCH_STATUS_VARIANT[m.status]}>{c.statuses[m.status]}</Badge>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BoardView({ board, matchBase }: BoardViewProps) {
  if (board.phases.every((p) => p.matches.length === 0))
    return <EmptyState icon={<GitForkIcon />} title={c.board.empty} />;
  return (
    <div className="flex flex-col gap-8">
      {board.champion && (
        <div className="flex items-center gap-3 rounded-md border border-brand p-4">
          <TrophyIcon aria-hidden className="size-6 text-brand" />
          <div className="flex flex-col">
            <span className="text-xs text-text-muted caps">{c.board.champion}</span>
            <span className="font-display text-2xl font-bold text-text">
              {board.champion.displayName}
            </span>
          </div>
        </div>
      )}
      {board.phases
        .filter((p) => p.matches.length > 0)
        .map((phase) => (
          <section key={phase.id} aria-label={phase.name} className="flex flex-col gap-4">
            <h3 className="font-display text-xl font-bold text-text caps">
              {phase.position}. {phase.name}
            </h3>
            {phase.tiebreakRequired && (
              <p className="text-sm text-warning">{c.board.tiebreakRequired}</p>
            )}
            {ELIMINATION.has(phase.format) ? (
              bracketRounds(phase, matchBase, board.timezone).map(({ side, rounds }) => (
                <div key={side ?? 'main'} className="flex flex-col gap-2">
                  {side && (
                    <h4 className="text-sm text-text-muted caps">{c.sides[side as 'upper']}</h4>
                  )}
                  <Bracket
                    label={`${c.board.bracket}: ${phase.name}`}
                    rounds={rounds}
                    renderLink={renderRouterLink}
                  />
                </div>
              ))
            ) : (
              <>
                <Tables phase={phase} />
                <MatchList
                  matches={phase.matches}
                  phase={phase}
                  matchBase={matchBase}
                  timeZone={board.timezone}
                />
              </>
            )}
          </section>
        ))}
    </div>
  );
}
