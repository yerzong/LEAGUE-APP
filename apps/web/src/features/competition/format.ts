// Presentation helpers of matches and tables: round names, empty slots,
// statuses and the tiebreak note. Pure, shared by admin, portal and public.
import type { MatchStatus, MatchSummary, PhaseBoard, StandingRow } from '@league/contracts';
import { format } from '@league/i18n';

import { messages } from '@/config/i18n';

const c = messages.competition;

export const MATCH_STATUS_VARIANT: Readonly<
  Record<MatchStatus, 'outline' | 'secondary' | 'warning' | 'success' | 'danger' | 'default'>
> = {
  pending: 'outline',
  scheduled: 'secondary',
  checkin: 'warning',
  ready: 'warning',
  live: 'success',
  awaiting_result: 'warning',
  disputed: 'danger',
  completed: 'secondary',
  forfeit: 'secondary',
  canceled: 'outline',
};

export const LIVE_STATUSES: ReadonlySet<MatchStatus> = new Set([
  'checkin',
  'ready',
  'live',
  'awaiting_result',
]);
export const FINISHED_STATUSES: ReadonlySet<MatchStatus> = new Set(['completed', 'forfeit']);

/** "R1-P2": a short, stable label of a match inside its phase. */
export const matchLabel = (m: Pick<MatchSummary, 'round' | 'position'>) =>
  format(c.matchLabel, { round: m.round, position: m.position });

/** Name of a bracket round: Final, Semifinales… counted from the last round of its side. */
export function roundTitle(
  phase: Pick<PhaseBoard, 'format'>,
  match: Pick<MatchSummary, 'round' | 'bracketSide' | 'bracketKey'>,
  lastRound: number,
): string {
  const r = c.rounds;
  if (match.bracketKey === 'third-place') return r.thirdPlace;
  if (match.bracketSide === 'final') return match.round === 1 ? r.grandFinal : r.reset;
  if (phase.format === 'single_elimination' || match.bracketSide === 'upper') {
    const fromEnd = lastRound - match.round;
    if (phase.format === 'single_elimination') {
      if (fromEnd === 0) return r.final;
      if (fromEnd === 1) return r.semifinal;
      if (fromEnd === 2) return r.quarterfinal;
      if (fromEnd === 3) return r.roundOf16;
    }
  }
  return format(r.round, { n: match.round });
}

/** Who fills an empty slot: "Ganador de R1-P2", or "Por definir". */
export function slotName(
  phaseMatches: readonly Pick<MatchSummary, 'bracketKey' | 'round' | 'position'>[],
  source: MatchSummary['sourceA'],
): string {
  if (!source) return c.slot.tbd;
  const from = phaseMatches.find((m) => m.bracketKey === source.bracketKey);
  const label = from ? matchLabel(from) : source.bracketKey.toUpperCase();
  return format(source.outcome === 'winner' ? c.slot.winnerOf : c.slot.loserOf, { match: label });
}

/** "Desempate: resultado directo (6), diferencia de partidas (+2)". */
export function tiebreakNote(row: Pick<StandingRow, 'tiebreaks' | 'tiedWith'>): string | null {
  if (row.tiedWith.length > 0) return c.table.unresolved;
  if (row.tiebreaks.length === 0) return null;
  const criteria = row.tiebreaks
    .map((step) => {
      const name = messages.tournaments.options.tiebreakers[step.criterion];
      const value = Number.isInteger(step.value) ? step.value : step.value.toFixed(1);
      return `${name} (${step.value > 0 && step.criterion.includes('diff') ? '+' : ''}${String(value)})`;
    })
    .join(', ');
  return format(c.table.tiebreak, { criteria });
}

export const signed = (n: number) => (n > 0 ? `+${String(n)}` : String(n));
