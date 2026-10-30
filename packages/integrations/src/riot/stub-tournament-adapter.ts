// Tournament-Stub adapter (docs/06 §5): the whole flow without touching Riot.
// It remembers each code's allowed PUUIDs and team size, and can synthesize a
// result callback plus the matching Match-V5 payload, so CI can run
// generate → callback → complete → standings end to end.

import type { MatchV5Payload } from './match-v5.js';
import type { RiotPlatform } from './ports.js';
import type {
  GenerateCodesParams,
  MatchDataPort,
  TeamSize,
  TournamentCallback,
  TournamentProviderPort,
} from './tournament-ports.js';

interface CodeState {
  readonly tournamentId: number;
  readonly teamSize: TeamSize;
  readonly allowedPuuids: readonly string[];
  readonly metadata: string;
  readonly region: RiotPlatform;
}

export interface StubTournamentOptions {
  readonly region?: RiotPlatform;
}

/** In-memory TournamentProviderPort + MatchDataPort. Never calls Riot. */
export class RiotStubTournamentAdapter implements TournamentProviderPort, MatchDataPort {
  private providerSeq = 1000;
  private tournamentSeq = 5000;
  private codeSeq = 0;
  private matchSeq = 0;
  private readonly codes = new Map<string, CodeState>();
  private readonly matches = new Map<string, MatchV5Payload>();
  private readonly region: RiotPlatform;

  constructor(options: StubTournamentOptions = {}) {
    this.region = options.region ?? 'la1';
  }

  createProvider(_region: RiotPlatform, _callbackUrl: string): Promise<number> {
    this.providerSeq += 1;
    return Promise.resolve(this.providerSeq);
  }

  createTournament(_providerId: number, _name: string): Promise<number> {
    this.tournamentSeq += 1;
    return Promise.resolve(this.tournamentSeq);
  }

  generateCodes(params: GenerateCodesParams): Promise<string[]> {
    const codes: string[] = [];
    for (let i = 0; i < params.count; i += 1) {
      this.codeSeq += 1;
      const code = `STUB-${String(params.tournamentId)}-${String(this.codeSeq).padStart(4, '0')}`;
      this.codes.set(code, {
        tournamentId: params.tournamentId,
        teamSize: params.teamSize,
        allowedPuuids: params.allowedPuuids,
        metadata: params.metadata,
        region: this.region,
      });
      codes.push(code);
    }
    return Promise.resolve(codes);
  }

  getMatch(matchId: string, _region: RiotPlatform): Promise<MatchV5Payload | null> {
    return Promise.resolve(this.matches.get(matchId) ?? null);
  }

  /**
   * Simulates a played game: builds the Match-V5 payload from the code's allowed
   * PUUIDs (padded with fillers if short) and returns the callback Riot would
   * send. `winner` picks the blue (first half) or red side.
   */
  simulateResult(
    shortCode: string,
    winner: 'blue' | 'red' = 'blue',
    overridePuuids?: readonly string[],
  ): TournamentCallback {
    const state = this.codes.get(shortCode);
    if (!state) throw new Error(`unknown tournament code: ${shortCode}`);
    const size = state.teamSize;
    const roster = overridePuuids ?? state.allowedPuuids;
    const puuids = Array.from(
      { length: size * 2 },
      (_, i) => roster[i] ?? `stub-filler-${String(i)}`,
    );
    this.matchSeq += 1;
    const matchId = `${state.region.toUpperCase()}_${String(4_000_000_000 + this.matchSeq)}`;
    this.matches.set(matchId, buildPayload(matchId, puuids, size, winner));
    return { shortCode, matchId, metadata: state.metadata, region: state.region };
  }

  /** The PUUIDs a code admits (test/debug). */
  allowedOf(shortCode: string): readonly string[] {
    return this.codes.get(shortCode)?.allowedPuuids ?? [];
  }
}

function buildPayload(
  matchId: string,
  puuids: readonly string[],
  size: number,
  winner: 'blue' | 'red',
): MatchV5Payload {
  const blueWins = winner === 'blue';
  const positions = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
  type P = MatchV5Payload['info']['participants'][number];
  type T = MatchV5Payload['info']['teams'][number];
  const participant = (puuid: string, index: number): P => {
    const blue = index < size;
    const winning = blue === blueWins;
    return {
      puuid,
      teamId: blue ? 100 : 200,
      championId: 100 + index,
      teamPosition: size === 5 ? (positions[index % 5] ?? '') : '',
      kills: winning ? 6 : 2,
      deaths: winning ? 2 : 6,
      assists: 7,
      totalMinionsKilled: 180,
      neutralMinionsKilled: 20,
      goldEarned: 12_000,
      totalDamageDealtToChampions: 15_000,
      totalDamageTaken: 14_000,
      visionScore: 25,
      wardsPlaced: 10,
      wardsKilled: 2,
      firstBloodKill: index === 0 && blueWins,
      doubleKills: 0,
      tripleKills: 0,
      quadraKills: 0,
      pentaKills: 0,
      turretKills: winning ? 2 : 0,
      dragonKills: 0,
      baronKills: 0,
      item0: 3078,
      item1: 0,
      item2: 0,
      item3: 0,
      item4: 0,
      item5: 0,
      item6: 3340,
    };
  };
  const objective = (first: boolean, kills: number) => ({ first, kills });
  const team = (blue: boolean): T => {
    const win = blue === blueWins;
    return {
      teamId: blue ? 100 : 200,
      win,
      bans: [],
      objectives: {
        baron: objective(win, win ? 1 : 0),
        dragon: objective(win, win ? 3 : 1),
        horde: objective(false, 2),
        inhibitor: objective(win, win ? 2 : 0),
        riftHerald: objective(win, 1),
        tower: objective(win, win ? 9 : 3),
      },
    };
  };
  return {
    metadata: { matchId },
    info: {
      gameDuration: 1_800,
      gameVersion: '14.20.1.1',
      gameEndTimestamp: 1_735_000_000_000,
      participants: puuids.map((puuid, index) => participant(puuid, index)),
      teams: [team(true), team(false)],
    },
  };
}
