import {
  RiotApiError,
  type RiotAccountIdentity,
  type RiotAccountPort,
  type RiotPlatform,
  type RiotRankEntry,
  type RiotRankTier,
  type RiotSummoner,
} from './ports.js';

const REGIONAL_HOST: Readonly<Record<RiotPlatform, string>> = {
  la1: 'americas',
  la2: 'americas',
  na1: 'americas',
  br1: 'americas',
};

const QUEUES: Readonly<Record<string, RiotRankEntry['queue']>> = {
  RANKED_SOLO_5x5: 'solo',
  RANKED_FLEX_SR: 'flex',
};

const TIERS: ReadonlySet<string> = new Set<RiotRankTier>([
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
]);

const DIVISIONS: Readonly<Record<string, 1 | 2 | 3 | 4>> = { I: 1, II: 2, III: 3, IV: 4 };
const APEX = new Set(['master', 'grandmaster', 'challenger']);

export interface RiotApiAccountAdapterOptions {
  /** Server-side only. Sent as `X-Riot-Token`, never in URLs or logs. */
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** RiotAccountPort over the Riot API (account-v1, summoner-v4, league-v4). */
export class RiotApiAccountAdapter implements RiotAccountPort {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: RiotApiAccountAdapterOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async findAccountByRiotId(
    gameName: string,
    tagLine: string,
    platform: RiotPlatform,
  ): Promise<RiotAccountIdentity | null> {
    const host = `https://${REGIONAL_HOST[platform]}.api.riotgames.com`;
    const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const body = await this.get(`${host}${path}`, { allowNotFound: true });
    if (body === null) return null;
    if (!isRecord(body) || typeof body['puuid'] !== 'string')
      throw new RiotApiError('unavailable', null);
    return {
      puuid: body['puuid'],
      gameName: typeof body['gameName'] === 'string' ? body['gameName'] : gameName,
      tagLine: typeof body['tagLine'] === 'string' ? body['tagLine'] : tagLine,
    };
  }

  async getSummoner(puuid: string, platform: RiotPlatform): Promise<RiotSummoner> {
    const body = await this.get(
      `${this.platformHost(platform)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`,
    );
    if (
      !isRecord(body) ||
      typeof body['profileIconId'] !== 'number' ||
      typeof body['summonerLevel'] !== 'number'
    ) {
      throw new RiotApiError('unavailable', null);
    }
    return { profileIconId: body['profileIconId'], summonerLevel: body['summonerLevel'] };
  }

  async getRankedEntries(puuid: string, platform: RiotPlatform): Promise<RiotRankEntry[]> {
    const body = await this.get(
      `${this.platformHost(platform)}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
    );
    if (!Array.isArray(body)) throw new RiotApiError('unavailable', null);
    return body.flatMap((entry: unknown): RiotRankEntry[] => {
      if (!isRecord(entry)) return [];
      const queue = QUEUES[String(entry['queueType'])];
      const tier = String(entry['tier']).toLowerCase();
      if (!queue || !TIERS.has(tier)) return [];
      return [
        {
          queue,
          tier: tier as RiotRankTier,
          division: APEX.has(tier) ? null : (DIVISIONS[String(entry['rank'])] ?? null),
          lp: Number(entry['leaguePoints'] ?? 0),
          wins: Number(entry['wins'] ?? 0),
          losses: Number(entry['losses'] ?? 0),
        },
      ];
    });
  }

  private platformHost(platform: RiotPlatform): string {
    return `https://${platform}.api.riotgames.com`;
  }

  private async get(url: string, { allowNotFound = false } = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { 'X-Riot-Token': this.options.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new RiotApiError('unavailable', null);
    }
    if (response.status === 404) {
      if (allowNotFound) return null;
      throw new RiotApiError('not_found', 404);
    }
    if (response.status === 429) throw new RiotApiError('rate_limited', 429);
    if (response.status === 401 || response.status === 403)
      throw new RiotApiError('unauthorized', response.status);
    if (!response.ok) throw new RiotApiError('unavailable', response.status);
    try {
      return await response.json();
    } catch {
      throw new RiotApiError('unavailable', response.status);
    }
  }
}
