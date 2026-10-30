// TournamentProviderPort + MatchDataPort over the real Riot API (Tournament-V5
// and Match-V5). Mirrors RiotApiAccountAdapter: the key is sent as X-Riot-Token
// and never logged; failures map to RiotApiError. Set RIOT_PROVIDER=riot.

import type { MatchV5Payload } from './match-v5.js';
import { RiotApiError, type RiotPlatform } from './ports.js';
import type {
  GenerateCodesParams,
  MatchDataPort,
  TournamentProviderPort,
} from './tournament-ports.js';

/** Tournament-V5 lives on the regional routing hosts; all our platforms → americas. */
const REGIONAL_HOST = 'https://americas.api.riotgames.com';

export interface RiotTournamentAdapterOptions {
  readonly apiKey: string;
  /** Tournament-Stub endpoints (no real games) vs the real Tournament-V5. */
  readonly stubApi?: boolean;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export class RiotTournamentAdapter implements TournamentProviderPort, MatchDataPort {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly base: string;

  constructor(private readonly options: RiotTournamentAdapterOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.base = `${REGIONAL_HOST}/lol/tournament${options.stubApi ? '-stub' : ''}/v5`;
  }

  async createProvider(region: RiotPlatform, callbackUrl: string): Promise<number> {
    const body = await this.send('POST', `${this.base}/providers`, {
      region: region.toUpperCase(),
      url: callbackUrl,
    });
    if (typeof body !== 'number') throw new RiotApiError('unavailable', null);
    return body;
  }

  async createTournament(providerId: number, name: string): Promise<number> {
    const body = await this.send('POST', `${this.base}/tournaments`, { name, providerId });
    if (typeof body !== 'number') throw new RiotApiError('unavailable', null);
    return body;
  }

  async generateCodes(params: GenerateCodesParams): Promise<string[]> {
    const query = new URLSearchParams({
      count: String(params.count),
      tournamentId: String(params.tournamentId),
    });
    const body = await this.send('POST', `${this.base}/codes?${query.toString()}`, {
      mapType: params.mapType,
      metadata: params.metadata,
      pickType: params.pickType,
      spectatorType: params.spectatorType,
      teamSize: params.teamSize,
      enoughPlayers: params.allowedPuuids.length >= params.teamSize * 2,
      ...(params.allowedPuuids.length > 0
        ? { allowedParticipants: [...params.allowedPuuids] }
        : {}),
    });
    if (!Array.isArray(body) || body.some((c) => typeof c !== 'string'))
      throw new RiotApiError('unavailable', null);
    return body as string[];
  }

  async getMatch(matchId: string, _region: RiotPlatform): Promise<MatchV5Payload | null> {
    const body = await this.get(
      `${REGIONAL_HOST}/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    );
    if (body === null) return null;
    if (!isRecord(body) || !isRecord(body['info'])) throw new RiotApiError('unavailable', null);
    return body as unknown as MatchV5Payload;
  }

  private async send(method: 'POST', url: string, payload: unknown): Promise<unknown> {
    return this.request(url, {
      method,
      headers: {
        'X-Riot-Token': this.options.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  private async get(url: string): Promise<unknown> {
    return this.request(url, {
      headers: { 'X-Riot-Token': this.options.apiKey, accept: 'application/json' },
      allowNotFound: true,
    });
  }

  private async request(
    url: string,
    init: RequestInit & { allowNotFound?: boolean },
  ): Promise<unknown> {
    const { allowNotFound, ...rest } = init;
    let response: Response;
    try {
      response = await this.fetchFn(url, { ...rest, signal: AbortSignal.timeout(this.timeoutMs) });
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
