export const RANK_TIERS = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
  'master',
  'grandmaster',
  'challenger',
] as const;

export type RankTier = (typeof RANK_TIERS)[number];
export type RankDivision = 1 | 2 | 3 | 4;

/** Apex tiers (master and above) have no division. */
export interface Rank {
  readonly tier: RankTier;
  readonly division?: RankDivision;
}

const FIRST_APEX = RANK_TIERS.indexOf('master');

export const isApexTier = (tier: RankTier) => RANK_TIERS.indexOf(tier) >= FIRST_APEX;

/** Ordinal value: iron IV = 0 … diamond I = 27, master 28, grandmaster 29, challenger 30. Unranked = -1. */
export function rankValue(rank: Rank | null): number {
  if (rank === null) return -1;
  const index = RANK_TIERS.indexOf(rank.tier);
  if (index >= FIRST_APEX) return FIRST_APEX * 4 + (index - FIRST_APEX);
  return index * 4 + (4 - (rank.division ?? 4));
}

export function rankFromValue(value: number): Rank | null {
  if (value < 0) return null;
  const apex = FIRST_APEX * 4;
  if (value >= apex) {
    return {
      tier: RANK_TIERS[Math.min(FIRST_APEX + value - apex, RANK_TIERS.length - 1)] ?? 'challenger',
    };
  }
  const tier = RANK_TIERS[Math.floor(value / 4)] ?? 'iron';
  return { tier, division: (4 - (value % 4)) as RankDivision };
}

export function compareRanks(a: Rank | null, b: Rank | null): number {
  return rankValue(a) - rankValue(b);
}

/** Stable code for messages: `gold_2`, `master`, `unranked`. */
export function formatRank(rank: Rank | null): string {
  if (rank === null) return 'unranked';
  return rank.division === undefined ? rank.tier : `${rank.tier}_${String(rank.division)}`;
}
