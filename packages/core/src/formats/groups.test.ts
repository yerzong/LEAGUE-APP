import { describe, expect, it } from 'vitest';

import { InvalidFormatConfigError } from '../errors.js';
import { DEFAULT_POINTS_RULE } from '../standings/points.js';
import type { Entrant, Match } from '../types.js';
import { assignGroups, groups } from './groups.js';

const entrants = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `E${String(i + 1)}`, seed: i + 1 }));

/** Lower entrant number wins 2-0, except the given upsets. */
function playAll(matches: readonly Match[], upsets: readonly string[] = []): Match[] {
  return matches.map((m) => {
    const a = Number((m.entrantA ?? '').slice(1));
    const b = Number((m.entrantB ?? '').slice(1));
    const key = [m.entrantA, m.entrantB].sort().join('-');
    const aWins = upsets.includes(key) ? a > b : a < b;
    return {
      ...m,
      status: 'completed',
      result: {
        scoreA: aWins ? 2 : 0,
        scoreB: aWins ? 0 : 2,
        winner: aWins ? m.entrantA : m.entrantB,
      },
    };
  });
}

describe('group assignment', () => {
  it('distributes seeds in a snake so groups are balanced', () => {
    expect(assignGroups(entrants(8), 2).map((g) => g.map((e) => e.id))).toEqual([
      ['E1', 'E4', 'E5', 'E8'],
      ['E2', 'E3', 'E6', 'E7'],
    ]);
    expect(assignGroups(entrants(7), 2).map((g) => g.length)).toEqual([3, 4]);
  });

  it('rejects a group count that leaves a group with fewer than two entrants', () => {
    expect(() =>
      groups.generateMatches(entrants(5), { seriesFormat: 'bo1', groupCount: 3 }),
    ).toThrow(InvalidFormatConfigError);
    expect(() =>
      groups.generateMatches(entrants(4), { seriesFormat: 'bo1', groupCount: 0 }),
    ).toThrow(InvalidFormatConfigError);
  });
});

describe('groups format', () => {
  it.each([
    [8, 2, 12],
    [6, 2, 6],
    [7, 2, 9],
    [4, 1, 6],
  ])('%i entrants in %i groups play %i matches inside their group', (n, groupCount, total) => {
    const matches = groups.generateMatches(entrants(n), { seriesFormat: 'bo1', groupCount });
    expect(matches).toHaveLength(total);
    const groupOf = new Map(
      assignGroups(entrants(n), groupCount).flatMap((g, i) =>
        g.map((e) => [e.id, `g${String(i + 1)}`]),
      ),
    );
    for (const m of matches) {
      expect(groupOf.get(m.entrantA ?? '')).toBe(m.groupId);
      expect(groupOf.get(m.entrantB ?? '')).toBe(m.groupId);
    }
    expect(new Set(matches.map((m) => m.id)).size).toBe(total);
  });

  it('plays each pair twice with two legs', () => {
    expect(
      groups.generateMatches(entrants(6), { seriesFormat: 'bo1', groupCount: 2, legs: 2 }),
    ).toHaveLength(12);
  });

  it('ranks each group separately and seeds advancers group winners first', () => {
    const matches = playAll(
      groups.generateMatches(entrants(8), { seriesFormat: 'bo3', groupCount: 2 }),
    );
    const standings = groups.computeStandings(matches, DEFAULT_POINTS_RULE, ['head_to_head']);
    expect(standings.map((s) => [s.groupId, s.rank, s.entrantId])).toEqual([
      ['g1', 1, 'E1'],
      ['g1', 2, 'E4'],
      ['g1', 3, 'E5'],
      ['g1', 4, 'E8'],
      ['g2', 1, 'E2'],
      ['g2', 2, 'E3'],
      ['g2', 3, 'E6'],
      ['g2', 4, 'E7'],
    ]);
    expect(groups.resolveAdvancement(standings, { count: 2 })).toEqual({
      status: 'resolved',
      advancing: ['E1', 'E2', 'E4', 'E3'],
      eliminated: ['E5', 'E8', 'E6', 'E7'],
    });
    expect(groups.isComplete(matches, { seriesFormat: 'bo3', groupCount: 2 })).toBe(true);
  });

  it('reports the tie of the group that cannot be resolved', () => {
    // Group 2: E3 beats E2, E6 beats E3, E2 beats E6 — a three-way circle of 2-0s.
    const matches = playAll(
      groups.generateMatches(entrants(8), { seriesFormat: 'bo3', groupCount: 2 }),
      ['E2-E3', 'E3-E6'],
    );
    const standings = groups.computeStandings(matches, DEFAULT_POINTS_RULE, [
      'head_to_head',
      'game_diff',
    ]);
    expect(groups.resolveAdvancement(standings, { count: 1 })).toEqual({
      status: 'requires_tiebreaker',
      advancing: ['E1'],
      eliminated: ['E4', 'E5', 'E8', 'E7'],
      tiedAtCutoff: ['E2', 'E3', 'E6'],
      openSlots: 1,
    });
  });

  it('records results like a round robin', () => {
    const [first, ...rest] = groups.generateMatches(entrants(4), {
      seriesFormat: 'bo1',
      groupCount: 1,
    });
    if (!first) throw new Error('no match');
    const done: Match = {
      ...first,
      status: 'completed',
      result: { scoreA: 1, scoreB: 0, winner: first.entrantA },
    };
    expect(groups.onMatchCompleted([first, ...rest], done)[0]).toMatchObject({
      status: 'completed',
    });
  });
});
