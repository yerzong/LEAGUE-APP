// MVPs and achievements (docs/specs/m09 §3). The MVP of any scope (game,
// match, week, tournament) is the best average performance score; the
// achievement rules are data (`achievements.criteria`) evaluated over a
// player's history.

export type MvpScope = 'game' | 'match' | 'week' | 'phase' | 'tournament';

export interface MvpCandidate {
  readonly userId: string | null;
  readonly score: number;
}

export interface MvpPick {
  readonly userId: string;
  readonly score: number;
  readonly games: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Best average score; ties go to more games, then the lowest user id. Unlinked players never win. */
export function pickMvp(
  lines: readonly MvpCandidate[],
  options: { readonly minGames?: number } = {},
): MvpPick | null {
  const by = new Map<string, number[]>();
  for (const l of lines) if (l.userId) by.set(l.userId, [...(by.get(l.userId) ?? []), l.score]);
  const picks = [...by]
    .filter(([, scores]) => scores.length >= (options.minGames ?? 1))
    .map(([userId, scores]) => ({
      userId,
      score: round(scores.reduce((a, b) => a + b, 0) / scores.length),
      games: scores.length,
    }))
    .sort((a, b) => b.score - a.score || b.games - a.games || a.userId.localeCompare(b.userId));
  return picks[0] ?? null;
}

/** The per-game numbers achievement rules can look at. */
export interface AwardLine {
  readonly gameId: string;
  readonly playedAt: string;
  readonly win: boolean;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly kda: number;
  readonly csPerMin: number;
  readonly visionScore: number;
  readonly damageShare: number;
  readonly killParticipation: number;
  readonly quadraKills: number;
  readonly pentaKills: number;
}

export const GAME_STAT_KEYS = [
  'kills',
  'deaths',
  'assists',
  'kda',
  'csPerMin',
  'visionScore',
  'damageShare',
  'killParticipation',
  'quadraKills',
  'pentaKills',
] as const satisfies readonly (keyof AwardLine)[];
export type GameStatKey = (typeof GAME_STAT_KEYS)[number];

export const TOTAL_STAT_KEYS = [
  'kills',
  'assists',
  'quadraKills',
  'pentaKills',
] as const satisfies readonly GameStatKey[];
export type TotalStatKey = (typeof TOTAL_STAT_KEYS)[number];

export type AchievementCriteria =
  /** One game meeting every condition (a pentakill, a deathless game…). */
  | {
      readonly type: 'game';
      readonly conditions: readonly {
        readonly stat: GameStatKey;
        readonly gte?: number | undefined;
        readonly lte?: number | undefined;
      }[];
    }
  /** A career total (100 kills…). */
  | { readonly type: 'total'; readonly stat: TotalStatKey; readonly gte: number }
  /** Games played, or won. */
  | { readonly type: 'games'; readonly gte: number; readonly wins?: boolean | undefined }
  /** Consecutive games won. */
  | { readonly type: 'win_streak'; readonly gte: number }
  /** MVP awards of a scope. */
  | { readonly type: 'mvp'; readonly scope: MvpScope; readonly gte: number };

export interface AchievementDef {
  readonly id: string;
  readonly criteria: AchievementCriteria;
}

export interface AchievementHistory {
  readonly lines: readonly AwardLine[];
  readonly mvps: readonly { readonly scope: MvpScope }[];
}

export interface EarnedAchievement {
  readonly achievementId: string;
  /** The game that earned it and/or the value reached. */
  readonly context: { readonly gameId?: string; readonly value?: number };
}

type Context = EarnedAchievement['context'];

/** Walks the games in the order played; the context is the first game that meets the rule. */
function earned(criteria: AchievementCriteria, history: AchievementHistory): Context | null {
  const lines = [...history.lines].sort(
    (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.gameId.localeCompare(b.gameId),
  );
  switch (criteria.type) {
    case 'game': {
      const hit = lines.find((l) =>
        criteria.conditions.every(
          (c) =>
            (c.gte === undefined || l[c.stat] >= c.gte) &&
            (c.lte === undefined || l[c.stat] <= c.lte),
        ),
      );
      return hit ? { gameId: hit.gameId } : null;
    }
    case 'total': {
      let total = 0;
      for (const l of lines) {
        total += l[criteria.stat];
        if (total >= criteria.gte) return { gameId: l.gameId, value: total };
      }
      return null;
    }
    case 'games': {
      const counted = criteria.wins ? lines.filter((l) => l.win) : lines;
      const hit = counted[criteria.gte - 1];
      return hit ? { gameId: hit.gameId } : null;
    }
    case 'win_streak': {
      let streak = 0;
      for (const l of lines) {
        streak = l.win ? streak + 1 : 0;
        if (streak >= criteria.gte) return { gameId: l.gameId, value: streak };
      }
      return null;
    }
    case 'mvp': {
      const value = history.mvps.filter((m) => m.scope === criteria.scope).length;
      return value >= criteria.gte ? { value } : null;
    }
  }
}

/** The achievements newly earned (never the ones in `already`), in definition order. */
export function evaluateAchievements(
  defs: readonly AchievementDef[],
  history: AchievementHistory,
  already: ReadonlySet<string>,
): EarnedAchievement[] {
  return defs.flatMap((def) => {
    if (already.has(def.id)) return [];
    const context = earned(def.criteria, history);
    return context ? [{ achievementId: def.id, context }] : [];
  });
}
