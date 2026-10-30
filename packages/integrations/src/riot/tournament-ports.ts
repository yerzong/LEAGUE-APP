// Tournament-V5 and Match-V5 ports (docs/06 §5, docs/specs/m08). The platform
// generates one tournament code per game with the frozen roster's PUUIDs, and
// resolves each finished game to its Match-V5 payload. Adapters: the real Riot
// API, a Tournament-Stub for dev/CI, and the manual fallback (no Riot).

import type { MatchV5Payload } from './match-v5.js';
import type { RiotPlatform } from './ports.js';

/** 1v1, 2v2 … 5v5 — the players per side a code admits. */
export type TeamSize = 1 | 2 | 3 | 4 | 5;
export type TournamentMapType = 'SUMMONERS_RIFT' | 'HOWLING_ABYSS';
export type TournamentPickType = 'BLIND_PICK' | 'DRAFT_MODE' | 'ALL_RANDOM' | 'TOURNAMENT_DRAFT';
export type TournamentSpectatorType = 'NONE' | 'LOBBYONLY' | 'ALL';

export interface GenerateCodesParams {
  readonly tournamentId: number;
  readonly count: number;
  readonly teamSize: TeamSize;
  /** PUUIDs allowed into the lobby (the frozen roster). Empty = open (dev only). */
  readonly allowedPuuids: readonly string[];
  readonly mapType: TournamentMapType;
  readonly pickType: TournamentPickType;
  readonly spectatorType: TournamentSpectatorType;
  /** Opaque string Riot echoes back in the callback (we put the game id here). */
  readonly metadata: string;
}

/** A result callback from Riot (Tournament-V5), normalized to what we read. */
export interface TournamentCallback {
  /** The tournament code the game was played with. */
  readonly shortCode: string;
  /** Riot match id (`<platform>_<gameId>`) used to fetch Match-V5. */
  readonly matchId: string;
  /** Our metadata echoed back (the game id we set at generation). */
  readonly metadata: string;
  readonly region: string;
}

export interface TournamentProviderPort {
  /** Registers a provider (region + callback URL). Once per region. */
  createProvider(region: RiotPlatform, callbackUrl: string): Promise<number>;
  /** Registers a tournament under a provider. Returns the Riot tournament id. */
  createTournament(providerId: number, name: string): Promise<number>;
  /** Generates `count` codes with the given lobby restrictions. */
  generateCodes(params: GenerateCodesParams): Promise<string[]>;
}

export interface MatchDataPort {
  /** The raw Match-V5 payload for a match id, or `null` if not found yet (polling). */
  getMatch(matchId: string, region: RiotPlatform): Promise<MatchV5Payload | null>;
}
