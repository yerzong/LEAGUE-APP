// Bracket machinery shared by single and double elimination: building the
// bracket with byes resolved up front, advancing entrants and placements.

import { BracketConflictError } from '../errors.js';
import { buildRecords, type PointsRule } from '../standings/points.js';
import type { Standing } from '../standings/standings.js';
import type {
  BracketSide,
  EntrantId,
  Match,
  MatchLink,
  MatchSlot,
  SeriesFormat,
  SlotSource,
} from '../types.js';
import { blankMatch, entrantsOf, isFinished, recordCompletion } from './shared.js';

/** Seed positions for a bracket of `size` (a power of two): 1v8, 4v5, 2v7, 3v6… */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** A slot before byes are resolved: a seed (maybe beyond the entrant count) or a match outcome. */
export type TemplateRef = SlotSource;

export interface MatchTemplate {
  readonly id: string;
  readonly round: number;
  readonly position: number;
  readonly bracketSide: BracketSide | null;
  readonly seriesFormat: SeriesFormat;
  readonly a: TemplateRef;
  readonly b: TemplateRef;
}

type Resolved =
  | { readonly kind: 'entrant'; readonly id: EntrantId; readonly seed: number }
  | { readonly kind: 'bye' }
  | { readonly kind: 'match'; readonly matchId: string; readonly outcome: 'winner' | 'loser' };

const BYE: Resolved = { kind: 'bye' };

/**
 * Turns templates (in dependency order) into matches. Seeds without an entrant
 * are byes: a match with a bye is not played, its real entrant goes straight
 * on and its "loser" is a bye, which can cascade through later rounds.
 */
export function buildBracket(
  templates: readonly MatchTemplate[],
  seeds: ReadonlyMap<number, EntrantId>,
): Match[] {
  const outcomes = new Map<string, Resolved>();
  const resolve = (ref: TemplateRef): Resolved => {
    if (ref.kind === 'seed') {
      const id = seeds.get(ref.seed);
      return id === undefined ? BYE : { kind: 'entrant', id, seed: ref.seed };
    }
    return outcomes.get(`${ref.matchId}:${ref.outcome}`) ?? BYE;
  };

  const kept: { template: MatchTemplate; a: Resolved; b: Resolved }[] = [];
  for (const template of templates) {
    const a = resolve(template.a);
    const b = resolve(template.b);
    const key = (outcome: string) => `${template.id}:${outcome}`;
    if (a.kind === 'bye' || b.kind === 'bye') {
      outcomes.set(key('winner'), a.kind === 'bye' ? b : a);
      outcomes.set(key('loser'), BYE);
      continue;
    }
    outcomes.set(key('winner'), { kind: 'match', matchId: template.id, outcome: 'winner' });
    outcomes.set(key('loser'), { kind: 'match', matchId: template.id, outcome: 'loser' });
    kept.push({ template, a, b });
  }

  const links = new Map<string, { winner?: MatchLink; loser?: MatchLink }>();
  for (const { template, a, b } of kept) {
    for (const [slot, ref] of [
      ['a', a],
      ['b', b],
    ] as const) {
      if (ref.kind !== 'match') continue;
      links.set(ref.matchId, {
        ...links.get(ref.matchId),
        [ref.outcome]: { matchId: template.id, slot },
      });
    }
  }

  const entrantOf = (ref: Resolved) => (ref.kind === 'entrant' ? ref.id : null);
  const sourceOf = (ref: Resolved): SlotSource | null =>
    ref.kind === 'entrant'
      ? { kind: 'seed', seed: ref.seed }
      : ref.kind === 'match'
        ? { kind: 'match', matchId: ref.matchId, outcome: ref.outcome }
        : null;

  return kept.map(({ template, a, b }) =>
    blankMatch({
      id: template.id,
      round: template.round,
      position: template.position,
      bracketSide: template.bracketSide,
      seriesFormat: template.seriesFormat,
      entrantA: entrantOf(a),
      entrantB: entrantOf(b),
      sourceA: sourceOf(a),
      sourceB: sourceOf(b),
      nextWinner: links.get(template.id)?.winner ?? null,
      nextLoser: links.get(template.id)?.loser ?? null,
    }),
  );
}

const EDITABLE: ReadonlySet<Match['status']> = new Set(['pending', 'scheduled']);

/** Puts `entrant` in a slot. Replacing a different entrant is only allowed before the match starts. */
export function placeEntrant(
  bracket: readonly Match[],
  link: MatchLink,
  entrant: EntrantId,
): Match[] {
  return bracket.map((m) => {
    if (m.id !== link.matchId) return m;
    const field = link.slot === 'a' ? 'entrantA' : 'entrantB';
    const current = m[field];
    if (current === entrant) return m;
    if (current !== null && !EDITABLE.has(m.status)) {
      throw new BracketConflictError(`Match ${m.id} already started with another entrant`, {
        matchId: m.id,
        slot: link.slot,
        current,
        incoming: entrant,
      });
    }
    return { ...m, [field]: entrant };
  });
}

export function loserOf(match: Match): EntrantId | null {
  const winner = match.result?.winner ?? null;
  if (winner === null) return null;
  return winner === match.entrantA ? match.entrantB : match.entrantA;
}

/** Records the result and sends winner and loser to their next matches. */
export function advance(bracket: readonly Match[], match: Match): Match[] {
  let next = recordCompletion(bracket, match, { allowDraw: false });
  const done = next.find((m) => m.id === match.id);
  const winner = done?.result?.winner ?? null;
  if (!done || winner === null) return next;
  const loser = loserOf(done);
  if (done.nextWinner) next = placeEntrant(next, done.nextWinner, winner);
  if (done.nextLoser && loser !== null) next = placeEntrant(next, done.nextLoser, loser);
  return next;
}

export const slotOf = (match: Match, entrant: EntrantId): MatchSlot | null =>
  match.entrantA === entrant ? 'a' : match.entrantB === entrant ? 'b' : null;

/**
 * Placement table: each entrant is ranked by the furthest match it reached
 * (`weight`), then by how that match went (won > still to play > lost).
 * Equal keys share the rank, e.g. both semifinal losers are 3rd.
 */
export function placementStandings(
  matches: readonly Match[],
  pointsRule: PointsRule,
  weight: (match: Match) => number,
): Standing[] {
  const entrants = entrantsOf(matches);
  const records = buildRecords(entrants, matches, pointsRule);
  const keyOf = (id: EntrantId): [number, number] => {
    let best: [number, number] = [Number.NEGATIVE_INFINITY, 0];
    for (const m of matches) {
      if (slotOf(m, id) === null || m.status === 'canceled') continue;
      const w = weight(m);
      const outcome = !isFinished(m) ? 1 : m.result?.winner === id ? 2 : 0;
      if (w > best[0] || (w === best[0] && outcome > best[1])) best = [w, outcome];
    }
    return best;
  };
  const keyed = entrants.map((id) => ({ id, key: keyOf(id) }));
  const ordered = [...keyed].sort((x, y) => y.key[0] - x.key[0] || y.key[1] - x.key[1]);

  const standings: Standing[] = [];
  ordered.forEach(({ id, key }, index) => {
    const record = records.get(id);
    if (!record) return;
    const previous = ordered[index - 1];
    const prevStanding = standings.at(-1);
    const shares =
      previous !== undefined && previous.key[0] === key[0] && previous.key[1] === key[1];
    standings.push({
      ...record,
      rank: shares && prevStanding ? prevStanding.rank : index + 1,
      groupId: null,
      tiebreaks: [],
      tiedWith: [],
    });
  });
  return standings;
}
