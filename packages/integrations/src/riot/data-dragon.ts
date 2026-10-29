// Champion names and icons from Riot's Data Dragon (static assets, allowed
// without an API key). Cached in memory; a failed refresh keeps the last
// good catalog. The static catalog serves tests, CI and offline work.

export interface ChampionInfo {
  /** Riot numeric id (Match-V5 `championId`). */
  readonly id: number;
  readonly name: string;
  readonly iconUrl: string | null;
}

export interface ChampionCatalogPort {
  champions(): Promise<ReadonlyMap<number, ChampionInfo>>;
}

export interface DataDragonOptions {
  /** Data Dragon locale; es_MX is the es-419 one. */
  readonly locale?: string;
  readonly ttlMs?: number;
  /** After a failure, wait this long before trying again. */
  readonly retryMs?: number;
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}

interface ChampionFile {
  readonly data: Readonly<
    Record<string, { readonly key: string; readonly id: string; readonly name: string }>
  >;
}

export class DataDragonChampionCatalog implements ChampionCatalogPort {
  private cache: { map: ReadonlyMap<number, ChampionInfo>; expiresAt: number } | null = null;
  private inflight: Promise<ReadonlyMap<number, ChampionInfo>> | null = null;
  private readonly locale: string;
  private readonly ttlMs: number;
  private readonly retryMs: number;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  constructor(options: DataDragonOptions = {}) {
    this.locale = options.locale ?? 'es_MX';
    this.ttlMs = options.ttlMs ?? 12 * 3_600_000;
    this.retryMs = options.retryMs ?? 5 * 60_000;
    this.baseUrl = (options.baseUrl ?? 'https://ddragon.leagueoflegends.com').replace(/\/$/, '');
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.now = options.now ?? Date.now;
  }

  champions(): Promise<ReadonlyMap<number, ChampionInfo>> {
    if (this.cache && this.cache.expiresAt > this.now()) return Promise.resolve(this.cache.map);
    this.inflight ??= this.load().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async json<T>(path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Data Dragon ${String(response.status)}`);
    return (await response.json()) as T;
  }

  private async load(): Promise<ReadonlyMap<number, ChampionInfo>> {
    try {
      const [version] = await this.json<string[]>('/api/versions.json');
      if (!version) throw new Error('Data Dragon without versions');
      const file = await this.json<ChampionFile>(
        `/cdn/${version}/data/${this.locale}/champion.json`,
      );
      const map = new Map<number, ChampionInfo>();
      for (const champion of Object.values(file.data)) {
        const id = Number(champion.key);
        if (Number.isInteger(id) && id > 0)
          map.set(id, {
            id,
            name: champion.name,
            iconUrl: `${this.baseUrl}/cdn/${version}/img/champion/${champion.id}.png`,
          });
      }
      this.cache = { map, expiresAt: this.now() + this.ttlMs };
      return map;
    } catch {
      // Keep serving the last catalog (or none: names fall back to the id).
      const map = this.cache?.map ?? new Map<number, ChampionInfo>();
      this.cache = { map, expiresAt: this.now() + this.retryMs };
      return map;
    }
  }
}

/** The champions the demo data uses, without icons. */
const STATIC: readonly (readonly [number, string])[] = [
  [266, 'Aatrox'],
  [122, 'Darius'],
  [86, 'Garen'],
  [24, 'Jax'],
  [164, 'Camille'],
  [897, "K'Sante"],
  [58, 'Renekton'],
  [54, 'Malphite'],
  [64, 'Lee Sin'],
  [104, 'Graves'],
  [254, 'Vi'],
  [234, 'Viego'],
  [113, 'Sejuani'],
  [59, 'Jarvan IV'],
  [57, 'Maokai'],
  [103, 'Ahri'],
  [84, 'Akali'],
  [61, 'Orianna'],
  [134, 'Syndra'],
  [157, 'Yasuo'],
  [238, 'Zed'],
  [268, 'Azir'],
  [99, 'Lux'],
  [22, 'Ashe'],
  [51, 'Caitlyn'],
  [81, 'Ezreal'],
  [222, 'Jinx'],
  [145, "Kai'Sa"],
  [110, 'Varus'],
  [498, 'Xayah'],
  [89, 'Leona'],
  [111, 'Nautilus'],
  [412, 'Thresh'],
  [526, 'Rell'],
  [117, 'Lulu'],
  [43, 'Karma'],
  [201, 'Braum'],
];

export class StaticChampionCatalog implements ChampionCatalogPort {
  private readonly map: ReadonlyMap<number, ChampionInfo> = new Map(
    STATIC.map(([id, name]) => [id, { id, name, iconUrl: null }]),
  );

  champions(): Promise<ReadonlyMap<number, ChampionInfo>> {
    return Promise.resolve(this.map);
  }
}
