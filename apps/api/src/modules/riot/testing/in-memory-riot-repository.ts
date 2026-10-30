// In-memory RiotRepository for the use-case tests. Stores the Riot bookkeeping
// (provider/tournament, codes, games, webhooks, alerts) and the frozen rosters;
// the match completion itself runs on the real m05 engine via MatchesDeps.

import type {
  CallbackLog,
  CodeContext,
  CodeView,
  RiotRepository,
  RiotSetup,
  RosterMember,
  StoredGameParticipant,
} from '../application/ports.js';

interface Game {
  readonly gameId: string;
  readonly matchId: string;
  readonly gameNumber: number;
  readonly blueEntrant: string;
  winner: string | null;
  status: 'live' | 'completed';
}

export class InMemoryRiotRepository implements RiotRepository {
  setup: RiotSetup | null = null;
  rosters = new Map<string, RosterMember[]>();
  games: Game[] = [];
  codes = new Map<
    string,
    {
      gameId: string;
      metadata: string;
      allowedPuuids: readonly string[];
      teamSize: number;
      generatedAt: string;
      status: 'active' | 'used' | 'revoked';
      usedAt: string | null;
      gameNumber: number;
    }
  >();
  webhooks = new Set<string>();
  callbacks: CallbackLog[] = [];
  alerts: { type: string; subjectId: string; evidence: Record<string, unknown> }[] = [];
  private seq = 0;

  constructor(private readonly tournamentId: string) {}

  setupOf(): Promise<RiotSetup | null> {
    return Promise.resolve(this.setup);
  }
  saveProvider(
    _organizationId: string,
    _actorId: string,
    region: string,
    riotProviderId: number,
  ): Promise<string> {
    this.setup = {
      providerRowId: 'provider-row',
      riotProviderId,
      riotTournamentId: this.setup?.riotTournamentId ?? 0,
      region,
    };
    return Promise.resolve('provider-row');
  }
  saveTournament(_t: string, _p: string, riotTournamentId: number): Promise<void> {
    if (this.setup) this.setup = { ...this.setup, riotTournamentId };
    return Promise.resolve();
  }
  openGame(matchId: string, gameNumber: number, blueEntrant: string): Promise<string> {
    const existing = this.games.find((g) => g.matchId === matchId && g.gameNumber === gameNumber);
    if (existing) return Promise.resolve(existing.gameId);
    this.seq += 1;
    const gameId = `game-${String(this.seq)}`;
    this.games.push({ gameId, matchId, gameNumber, blueEntrant, winner: null, status: 'live' });
    return Promise.resolve(gameId);
  }
  saveCode(input: {
    gameId: string;
    code: string;
    allowedPuuids: readonly string[];
    teamSize: number;
    metadata: string;
  }): Promise<void> {
    for (const [, v] of this.codes) if (v.gameId === input.gameId) v.status = 'revoked';
    const game = this.games.find((g) => g.gameId === input.gameId);
    this.codes.set(input.code, {
      gameId: input.gameId,
      metadata: input.metadata,
      allowedPuuids: input.allowedPuuids,
      teamSize: input.teamSize,
      generatedAt: '2026-10-30T18:00:00.000Z',
      status: 'active',
      usedAt: null,
      gameNumber: game?.gameNumber ?? 1,
    });
    return Promise.resolve();
  }
  rosterOf(entrantId: string): Promise<RosterMember[]> {
    return Promise.resolve(this.rosters.get(entrantId) ?? []);
  }
  codeContext(shortCode: string): Promise<CodeContext | null> {
    const code = this.codes.get(shortCode);
    if (!code) return Promise.resolve(null);
    const game = this.games.find((g) => g.gameId === code.gameId);
    if (!game) return Promise.resolve(null);
    return Promise.resolve({
      gameId: game.gameId,
      matchId: game.matchId,
      tournamentId: this.tournamentId,
      gameNumber: game.gameNumber,
      metadata: code.metadata,
    });
  }
  logWebhook(
    _org: string | null,
    source: string,
    eventType: string,
    idempotencyKey: string,
  ): Promise<boolean> {
    const key = `${source}:${idempotencyKey}`;
    if (this.webhooks.has(key)) return Promise.resolve(false);
    this.webhooks.add(key);
    this.callbacks.unshift({
      eventType,
      status: 'received',
      receivedAt: '2026-10-30T18:00:00.000Z',
      error: null,
    });
    return Promise.resolve(true);
  }
  markWebhook(
    _source: string,
    _key: string,
    status: 'processed' | 'failed' | 'skipped',
    error: string | null,
  ): Promise<void> {
    if (this.callbacks[0]) this.callbacks[0] = { ...this.callbacks[0], status, error };
    return Promise.resolve();
  }
  recordGame(input: {
    gameId: string;
    winnerEntrantId: string;
    participants: readonly StoredGameParticipant[];
  }): Promise<void> {
    const game = this.games.find((g) => g.gameId === input.gameId);
    if (game) {
      game.winner = input.winnerEntrantId;
      game.status = 'completed';
    }
    for (const [, v] of this.codes)
      if (v.gameId === input.gameId) {
        v.status = 'used';
        v.usedAt = '2026-10-30T18:05:00.000Z';
      }
    return Promise.resolve();
  }
  raiseIntegrityAlert(input: {
    type: 'roster_mismatch';
    subjectId: string;
    evidence: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    this.alerts.push({ type: input.type, subjectId: input.subjectId, evidence: input.evidence });
    return Promise.resolve();
  }
  completedGames(matchId: string): Promise<{ number: number; winner: 'a' | 'b' }[]> {
    return Promise.resolve(
      this.games
        .filter((g) => g.matchId === matchId && g.status === 'completed' && g.winner !== null)
        .map((g) => ({ number: g.gameNumber, winner: g.winner === g.blueEntrant ? 'a' : 'b' })),
    );
  }
  codesForMatch(matchId: string): Promise<CodeView[]> {
    const gameIds = new Set(this.games.filter((g) => g.matchId === matchId).map((g) => g.gameId));
    return Promise.resolve(
      [...this.codes.values()]
        .filter((c) => gameIds.has(c.gameId))
        .map((c) => ({
          gameNumber: c.gameNumber,
          code: [...this.codes].find(([, v]) => v === c)?.[0] ?? '',
          status: c.status,
          teamSize: c.teamSize,
          allowedCount: c.allowedPuuids.length,
          generatedAt: c.generatedAt,
          usedAt: c.usedAt,
        })),
    );
  }
  integrationCounts(): Promise<{ generated: number; used: number; openAlerts: number }> {
    const values = [...this.codes.values()];
    return Promise.resolve({
      generated: values.length,
      used: values.filter((c) => c.status === 'used').length,
      openAlerts: this.alerts.length,
    });
  }
  recentCallbacks(): Promise<CallbackLog[]> {
    return Promise.resolve(this.callbacks);
  }
}
