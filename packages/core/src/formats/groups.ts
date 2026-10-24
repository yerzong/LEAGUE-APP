import { InvalidFormatConfigError } from '../errors.js';
import { computeTable, type Standing } from '../standings/standings.js';
import type { Entrant, EntrantId } from '../types.js';
import { scheduleRoundRobin } from './round-robin.js';
import {
  assertPositiveInteger,
  assertSeriesFormat,
  entrantsOf,
  isTerminal,
  orderBySeed,
  recordCompletion,
  topAdvancement,
} from './shared.js';
import type { AdvancementResult, BaseFormatConfig, PhaseFormatStrategy } from './strategy.js';

export interface GroupsConfig extends BaseFormatConfig {
  readonly groupCount: number;
  /** 2 for a double round robin inside each group. */
  readonly legs?: 1 | 2;
}

export const groupId = (index: number) => `g${String(index + 1)}`;

/** Snake distribution: 1→A, 2→B, 3→B, 4→A… keeps the groups balanced by seed. */
export function assignGroups(entrants: readonly Entrant[], groupCount: number): Entrant[][] {
  const buckets: Entrant[][] = Array.from({ length: groupCount }, () => []);
  orderBySeed(entrants, 0).forEach((entrant, i) => {
    const lap = Math.floor(i / groupCount);
    const offset = i % groupCount;
    buckets[lap % 2 === 0 ? offset : groupCount - 1 - offset]?.push(entrant);
  });
  return buckets;
}

function byGroup(standings: readonly Standing[]): Standing[][] {
  const map = new Map<string | null, Standing[]>();
  for (const s of standings) map.set(s.groupId, [...(map.get(s.groupId) ?? []), s]);
  return [...map.values()];
}

/** Interleaves per-group lists by position: 1A, 1B, 2A, 2B… */
function interleave(lists: readonly (readonly EntrantId[])[]): EntrantId[] {
  const longest = Math.max(0, ...lists.map((l) => l.length));
  return Array.from({ length: longest }, (_, i) => lists.flatMap((l) => l[i] ?? [])).flat();
}

export const groups: PhaseFormatStrategy<GroupsConfig> = {
  format: 'groups',

  generateMatches(entrants, config) {
    const seriesFormat = assertSeriesFormat(config.seriesFormat);
    const groupCount = assertPositiveInteger(config.groupCount, 'groupCount');
    if (entrants.length < groupCount * 2) {
      throw new InvalidFormatConfigError('Every group needs at least two entrants', {
        field: 'groupCount',
        value: groupCount,
        entrants: entrants.length,
      });
    }
    return assignGroups(entrants, groupCount).flatMap((members, i) =>
      scheduleRoundRobin(members, {
        seriesFormat,
        legs: config.legs ?? 1,
        groupId: groupId(i),
        idPrefix: `${groupId(i)}-`,
      }),
    );
  },

  computeStandings(matches, pointsRule, tiebreakRule) {
    const ids = [...new Set(matches.map((m) => m.groupId))].sort();
    return ids.flatMap((id) => {
      const inGroup = matches.filter((m) => m.groupId === id);
      return computeTable({
        entrants: entrantsOf(inGroup),
        matches: inGroup,
        pointsRule,
        tiebreakRule,
        groupId: id,
      });
    });
  },

  resolveAdvancement(standings, advancement): AdvancementResult {
    const results = byGroup(standings).map((group) => topAdvancement(group, advancement.count));
    const advancing = interleave(results.map((r) => r.advancing));
    const eliminated = results.flatMap((r) => r.eliminated);
    const pending = results.flatMap((r) => (r.status === 'requires_tiebreaker' ? [r] : []));
    if (pending.length === 0) {
      return { status: 'resolved', advancing, eliminated };
    }
    return {
      status: 'requires_tiebreaker',
      advancing,
      eliminated,
      tiedAtCutoff: pending.flatMap((r) => r.tiedAtCutoff),
      openSlots: pending.reduce((sum, r) => sum + r.openSlots, 0),
    };
  },

  onMatchCompleted: (bracket, match) => recordCompletion(bracket, match, { allowDraw: true }),
  isComplete: (matches) => matches.every(isTerminal),
};
