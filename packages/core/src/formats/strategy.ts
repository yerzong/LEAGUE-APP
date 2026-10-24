import type { PointsRule } from '../standings/points.js';
import type { Standing } from '../standings/standings.js';
import type { TiebreakRule } from '../standings/tiebreakers.js';
import type { Entrant, EntrantId, Match, SeriesFormat } from '../types.js';

/** Every format reads at least the series format of its matches. */
export interface BaseFormatConfig {
  readonly seriesFormat: SeriesFormat;
}

export interface AdvancementConfig {
  /** How many advance. In group formats the count is per group. */
  readonly count: number;
}

export type AdvancementResult =
  | {
      readonly status: 'resolved';
      /** In seeding order for the next phase. */
      readonly advancing: readonly EntrantId[];
      readonly eliminated: readonly EntrantId[];
    }
  | {
      readonly status: 'requires_tiebreaker';
      readonly advancing: readonly EntrantId[];
      readonly eliminated: readonly EntrantId[];
      /** Entrants level at the cut line; `openSlots` of them advance after the tiebreaker. */
      readonly tiedAtCutoff: readonly EntrantId[];
      readonly openSlots: number;
    };

/** A phase format (Strategy). New formats are added, existing ones untouched. */
export interface PhaseFormatStrategy<TConfig extends BaseFormatConfig = BaseFormatConfig> {
  readonly format: string;
  /** Fixture or bracket. Formats whose pairings depend on results (Swiss) return the first round. */
  generateMatches(entrants: readonly Entrant[], config: TConfig): Match[];
  computeStandings(
    matches: readonly Match[],
    pointsRule: PointsRule,
    tiebreakRule: TiebreakRule,
  ): Standing[];
  resolveAdvancement(
    standings: readonly Standing[],
    advancement: AdvancementConfig,
  ): AdvancementResult;
  /** Records a finished match (with its `result`) and moves its entrants forward. */
  onMatchCompleted(bracket: readonly Match[], match: Match): Match[];
  isComplete(matches: readonly Match[]): boolean;
}
