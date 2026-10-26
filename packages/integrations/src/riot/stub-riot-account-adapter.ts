import {
  RiotApiError,
  type RiotAccountIdentity,
  type RiotAccountPort,
  type RiotPlatform,
  type RiotRankEntry,
  type RiotSummoner,
} from './ports.js';

/** Base icons every account owns (the ones verification asks for). */
export const BASE_ICON_COUNT = 29;

export interface StubAccount extends RiotAccountIdentity {
  readonly profileIconId: number;
  readonly summonerLevel: number;
  readonly ranks: readonly RiotRankEntry[];
}

export interface StubRiotAccountAdapterOptions {
  readonly accounts?: readonly StubAccount[];
  /**
   * Local runs and E2E: any Riot ID exists (except names starting with
   * "missing"), and the player "changes the icon" after the first lookup to
   * the next base icon (names starting with "mismatch" never change it).
   */
  readonly generateAccounts?: boolean;
}

const key = (gameName: string, tagLine: string) =>
  `${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;

/** In-memory RiotAccountPort: never calls Riot. */
export class StubRiotAccountAdapter implements RiotAccountPort {
  private readonly byRiotId = new Map<string, StubAccount>();
  private readonly byPuuid = new Map<string, StubAccount>();
  private readonly lookups = new Map<string, number>();

  constructor(private readonly options: StubRiotAccountAdapterOptions = {}) {
    for (const account of options.accounts ?? []) this.save(account);
  }

  setProfileIcon(puuid: string, profileIconId: number): void {
    const account = this.byPuuid.get(puuid);
    if (account) this.save({ ...account, profileIconId });
  }

  findAccountByRiotId(
    gameName: string,
    tagLine: string,
    _platform: RiotPlatform,
  ): Promise<RiotAccountIdentity | null> {
    let account = this.byRiotId.get(key(gameName, tagLine));
    if (
      !account &&
      this.options.generateAccounts &&
      !gameName.toLowerCase().startsWith('missing')
    ) {
      account = this.generate(gameName, tagLine);
    }
    return Promise.resolve(
      account
        ? { puuid: account.puuid, gameName: account.gameName, tagLine: account.tagLine }
        : null,
    );
  }

  getSummoner(puuid: string, _platform: RiotPlatform): Promise<RiotSummoner> {
    const account = this.byPuuid.get(puuid);
    if (!account) return Promise.reject(new RiotApiError('not_found', 404));
    const seen = this.lookups.get(puuid) ?? 0;
    this.lookups.set(puuid, seen + 1);
    const changes =
      this.options.generateAccounts &&
      seen > 0 &&
      !account.gameName.toLowerCase().startsWith('mismatch');
    const profileIconId = changes
      ? (account.profileIconId + 1) % BASE_ICON_COUNT
      : account.profileIconId;
    return Promise.resolve({ profileIconId, summonerLevel: account.summonerLevel });
  }

  getRankedEntries(puuid: string, _platform: RiotPlatform): Promise<RiotRankEntry[]> {
    const account = this.byPuuid.get(puuid);
    return account
      ? Promise.resolve([...account.ranks])
      : Promise.reject(new RiotApiError('not_found', 404));
  }

  private generate(gameName: string, tagLine: string): StubAccount {
    const account: StubAccount = {
      puuid: `stub-${Buffer.from(key(gameName, tagLine)).toString('base64url')}`,
      gameName,
      tagLine,
      profileIconId: 0,
      summonerLevel: 100,
      ranks: [{ queue: 'solo', tier: 'gold', division: 2, lp: 50, wins: 20, losses: 18 }],
    };
    this.save(account);
    return account;
  }

  private save(account: StubAccount): void {
    this.byRiotId.set(key(account.gameName, account.tagLine), account);
    this.byPuuid.set(account.puuid, account);
  }
}
