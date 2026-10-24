// RiotAccountPort (docs/04-arquitectura.md §5): what the platform needs from
// Riot to link an account. Adapters: Riot API (icon verification) and a stub.

/** Riot platforms supported for now; all route through `americas` for account-v1. */
export type RiotPlatform = 'la1' | 'la2' | 'na1' | 'br1';

export interface RiotAccountIdentity {
  readonly puuid: string;
  readonly gameName: string;
  readonly tagLine: string;
}

export interface RiotSummoner {
  readonly profileIconId: number;
  readonly summonerLevel: number;
}

export type RiotRankTier =
  | 'iron'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'emerald'
  | 'diamond'
  | 'master'
  | 'grandmaster'
  | 'challenger';

export interface RiotRankEntry {
  readonly queue: 'solo' | 'flex';
  readonly tier: RiotRankTier;
  /** `null` for master and above. */
  readonly division: 1 | 2 | 3 | 4 | null;
  readonly lp: number;
  readonly wins: number;
  readonly losses: number;
}

export interface RiotAccountPort {
  /** `null` when the Riot ID does not exist. */
  findAccountByRiotId(
    gameName: string,
    tagLine: string,
    platform: RiotPlatform,
  ): Promise<RiotAccountIdentity | null>;
  getSummoner(puuid: string, platform: RiotPlatform): Promise<RiotSummoner>;
  getRankedEntries(puuid: string, platform: RiotPlatform): Promise<RiotRankEntry[]>;
}

export type RiotApiErrorKind = 'rate_limited' | 'unauthorized' | 'not_found' | 'unavailable';

/** A failure talking to Riot. Never carries the API key. */
export class RiotApiError extends Error {
  constructor(
    readonly kind: RiotApiErrorKind,
    readonly status: number | null,
  ) {
    super(`Riot API error: ${kind}${status === null ? '' : ` (${String(status)})`}`);
    this.name = 'RiotApiError';
  }
}
