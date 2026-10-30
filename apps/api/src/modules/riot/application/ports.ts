// What the Riot Tournament use cases need from the database. The match
// completion itself reuses the m05 engine (see deps.matches); this repository
// covers the Riot-specific bookkeeping, the frozen roster and integrity alerts.

import type { TournamentCodeStatus } from '@league/contracts';
import type { TeamSize } from '@league/integrations';

export interface RiotSetup {
  readonly providerRowId: string;
  readonly riotProviderId: number;
  readonly riotTournamentId: number;
  readonly region: string;
}

export interface TournamentInfo {
  readonly organizationId: string;
  readonly name: string;
  readonly supervision: string;
  /** Riot provider region for this org (where codes are generated). */
  readonly region: string;
}

export interface RosterMember {
  readonly userId: string;
  readonly puuid: string;
  readonly riotAccountId: string;
}

export interface CodeContext {
  readonly gameId: string;
  readonly matchId: string;
  readonly tournamentId: string;
  readonly gameNumber: number;
  readonly metadata: string;
}

export interface StoredGameParticipant {
  readonly entrantId: string;
  readonly userId: string | null;
  readonly riotAccountId: string | null;
  readonly puuid: string;
  readonly side: 'blue' | 'red';
  readonly gameRole: string | null;
  readonly championId: number | null;
  readonly isExpected: boolean;
}

export interface CodeView {
  readonly gameNumber: number;
  readonly code: string;
  readonly status: TournamentCodeStatus;
  readonly teamSize: number;
  readonly allowedCount: number;
  readonly generatedAt: string;
  readonly usedAt: string | null;
}

export interface CallbackLog {
  readonly eventType: string;
  readonly status: 'received' | 'processed' | 'failed' | 'skipped';
  readonly receivedAt: string;
  readonly error: string | null;
}

export interface RiotRepository {
  setupOf(tournamentId: string): Promise<RiotSetup | null>;
  saveProvider(
    organizationId: string,
    actorId: string,
    region: string,
    riotProviderId: number,
    callbackUrl: string,
  ): Promise<string>;
  saveTournament(
    tournamentId: string,
    providerRowId: string,
    riotTournamentId: number,
    name: string,
  ): Promise<void>;
  openGame(
    matchId: string,
    gameNumber: number,
    blueEntrant: string,
    redEntrant: string,
  ): Promise<string>;
  saveCode(input: {
    readonly gameId: string;
    readonly riotTournamentId: number;
    readonly code: string;
    readonly allowedPuuids: readonly string[];
    readonly teamSize: TeamSize;
    readonly map: string;
    readonly pickType: string;
    readonly spectatorType: string;
    readonly metadata: string;
  }): Promise<void>;
  /** Active roster PUUIDs of an entrant (starters first). */
  rosterOf(entrantId: string): Promise<RosterMember[]>;
  /** The game + match a code was generated for, by its short code. */
  codeContext(shortCode: string): Promise<CodeContext | null>;
  logWebhook(
    organizationId: string | null,
    source: string,
    eventType: string,
    idempotencyKey: string,
    payload: unknown,
    signatureValid: boolean,
  ): Promise<boolean>;
  markWebhook(
    source: string,
    idempotencyKey: string,
    status: 'processed' | 'failed' | 'skipped',
    error: string | null,
  ): Promise<void>;
  recordGame(input: {
    readonly gameId: string;
    readonly winnerEntrantId: string;
    readonly payload: unknown;
    readonly durationSeconds: number;
    readonly patch: string | null;
    readonly riotMatchId: string;
    readonly participants: readonly StoredGameParticipant[];
  }): Promise<void>;
  raiseIntegrityAlert(input: {
    readonly organizationId: string;
    readonly type: 'roster_mismatch';
    readonly severity: number;
    readonly subjectId: string;
    readonly evidence: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  /** Completed games of a match, as slot results for the series score. */
  completedGames(matchId: string): Promise<{ number: number; winner: 'a' | 'b' }[]>;
  codesForMatch(matchId: string): Promise<CodeView[]>;
  integrationCounts(
    tournamentId: string,
  ): Promise<{ generated: number; used: number; openAlerts: number }>;
  recentCallbacks(organizationId: string, limit: number): Promise<CallbackLog[]>;
}

export const RIOT_REPOSITORY = Symbol('RiotRepository');
