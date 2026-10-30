// Riot Tournament use cases (docs/specs/m08): connect a tournament to Riot,
// generate a per-game code with the frozen roster, and process the result
// callback (idempotent) — storing the payload, checking roster integrity and
// completing the match through the m05 engine. Manual mode disables all of it.

import type {
  GenerateCodeRequest,
  RiotCallback,
  RiotCallbackAck,
  RiotIntegrationStatus,
  MatchCodes,
} from '@league/contracts';
import {
  normalizeMatchV5,
  type GenerateCodesParams,
  type MatchV5Payload,
  type TeamSize,
  type RiotPlatform,
} from '@league/integrations';
import { resolveSeries } from '@league/core';

import { conflict, forbidden, notFound } from '../../../shared/application-error.js';
import { completion, compactUpdates, loadState } from '../../matches/application/engine.js';
import type { RiotDeps } from './deps.js';
import type { RosterMember, StoredGameParticipant } from './ports.js';

const AUTOMATIC = 'automatic';

function clampTeamSize(count: number): TeamSize {
  return Math.min(5, Math.max(1, count)) as TeamSize;
}

async function requireConnected(deps: RiotDeps, tournamentId: string) {
  const setup = await deps.repo.setupOf(tournamentId);
  if (!setup) throw conflict('riot_not_connected');
  return setup;
}

/** Registers the provider (once per org) and the tournament in Riot. */
export class ConnectRiotUseCase {
  constructor(private readonly deps: RiotDeps) {}

  async execute(actorId: string, tournamentId: string): Promise<{ riotTournamentId: number }> {
    const api = this.deps.tournamentApi;
    if (!api) throw conflict('riot_unavailable');
    const tournament = await this.deps.tournaments.findById(tournamentId);
    if (!tournament) throw notFound('tournament_not_found');
    const organizationId = await this.deps.organization.id();
    const region = this.deps.settings.region as RiotPlatform;
    const providerId = await api.createProvider(region, this.deps.settings.callbackUrl);
    const providerRowId = await this.deps.repo.saveProvider(
      organizationId,
      actorId,
      region,
      providerId,
      this.deps.settings.callbackUrl,
    );
    const riotTournamentId = await api.createTournament(providerId, tournament.config.basics.name);
    await this.deps.repo.saveTournament(
      tournamentId,
      providerRowId,
      riotTournamentId,
      tournament.config.basics.name,
    );
    return { riotTournamentId };
  }
}

/** Generates (or regenerates) the tournament code for a game of a match. */
export class GenerateCodeUseCase {
  constructor(private readonly deps: RiotDeps) {}

  async execute(matchId: string, input: GenerateCodeRequest): Promise<{ code: string }> {
    const api = this.deps.tournamentApi;
    if (!api) throw conflict('riot_unavailable');
    const match = await this.deps.matches.matches.find(matchId);
    if (!match) throw notFound('match_not_found');
    if (!match.entrantA || !match.entrantB) throw conflict('entrants_missing');
    const tournament = await this.deps.tournaments.findById(match.tournamentId);
    if (tournament?.config.supervision.level !== AUTOMATIC) throw conflict('not_automatic');
    const setup = await requireConnected(this.deps, match.tournamentId);

    const played = await this.deps.repo.completedGames(matchId);
    const gameNumber = input.gameNumber ?? played.length + 1;

    const [rosterA, rosterB] = await Promise.all([
      this.deps.repo.rosterOf(match.entrantA),
      this.deps.repo.rosterOf(match.entrantB),
    ]);
    const teamSize = clampTeamSize(tournament.config.game.teamSize || rosterA.length || 1);
    const allowedPuuids = [...rosterA, ...rosterB].map((m) => m.puuid);

    const gameId = await this.deps.repo.openGame(
      matchId,
      gameNumber,
      match.entrantA,
      match.entrantB,
    );
    const params: GenerateCodesParams = {
      tournamentId: setup.riotTournamentId,
      count: 1,
      teamSize,
      allowedPuuids,
      mapType: teamSize === 5 ? 'SUMMONERS_RIFT' : 'HOWLING_ABYSS',
      pickType: 'TOURNAMENT_DRAFT',
      spectatorType: 'ALL',
      metadata: gameId,
    };
    const [code] = await api.generateCodes(params);
    if (!code) throw conflict('code_generation_failed');
    await this.deps.repo.saveCode({
      gameId,
      riotTournamentId: setup.riotTournamentId,
      code,
      allowedPuuids,
      teamSize,
      map: params.mapType,
      pickType: params.pickType,
      spectatorType: params.spectatorType,
      metadata: gameId,
    });
    return { code };
  }
}

export class ProcessRiotCallbackUseCase {
  constructor(private readonly deps: RiotDeps) {}

  async execute(callback: RiotCallback): Promise<RiotCallbackAck> {
    const organizationId = await this.deps.organization.id();
    const region = (callback.region ?? this.deps.settings.region).toLowerCase();
    const matchId = callback.matchId ?? `${region.toUpperCase()}_${String(callback.gameId)}`;
    const idempotencyKey = callback.matchId ?? `${callback.shortCode}:${String(callback.gameId)}`;

    const fresh = await this.deps.repo.logWebhook(
      organizationId,
      'riot',
      'tournament.result',
      idempotencyKey,
      callback,
      true,
    );
    if (!fresh) return { status: 'duplicate' };

    try {
      const ctx = await this.deps.repo.codeContext(callback.shortCode);
      if (!ctx) {
        await this.deps.repo.markWebhook('riot', idempotencyKey, 'skipped', 'unknown code');
        return { status: 'skipped' };
      }
      const match = await this.deps.matches.matches.find(ctx.matchId);
      if (!match?.entrantA || !match.entrantB) {
        await this.deps.repo.markWebhook('riot', idempotencyKey, 'skipped', 'match gone');
        return { status: 'skipped' };
      }
      const tournament = await this.deps.tournaments.findById(match.tournamentId);
      if (tournament?.config.supervision.level !== AUTOMATIC) {
        await this.deps.repo.markWebhook('riot', idempotencyKey, 'skipped', 'not automatic');
        return { status: 'skipped' };
      }
      if (!this.deps.matchData) {
        await this.deps.repo.markWebhook(
          'riot',
          idempotencyKey,
          'skipped',
          'match data unavailable',
        );
        return { status: 'skipped' };
      }
      const payload = await this.deps.matchData.getMatch(matchId, region as RiotPlatform);
      if (!payload) {
        await this.deps.repo.markWebhook('riot', idempotencyKey, 'failed', 'match data not ready');
        return { status: 'pending' };
      }

      const [rosterA, rosterB] = await Promise.all([
        this.deps.repo.rosterOf(match.entrantA),
        this.deps.repo.rosterOf(match.entrantB),
      ]);
      const { participants, winnerEntrantId, unexpected } = this.resolve(
        payload,
        match.entrantA,
        match.entrantB,
        rosterA,
        rosterB,
      );

      const normalized = normalizeMatchV5(payload);
      await this.deps.repo.recordGame({
        gameId: ctx.gameId,
        winnerEntrantId,
        payload,
        durationSeconds: normalized.durationSeconds,
        patch: normalized.patch,
        riotMatchId: matchId,
        participants,
      });

      if (unexpected.length > 0) {
        await this.deps.repo.raiseIntegrityAlert({
          organizationId,
          type: 'roster_mismatch',
          severity: 3,
          subjectId: ctx.gameId,
          evidence: { matchId, unexpected },
        });
      }

      await this.maybeCompleteMatch(match.tournamentId, ctx.matchId);
      await this.deps.repo.markWebhook('riot', idempotencyKey, 'processed', null);
      return { status: 'processed' };
    } catch (error) {
      await this.deps.repo.markWebhook(
        'riot',
        idempotencyKey,
        'failed',
        error instanceof Error ? error.message : 'callback failed',
      );
      throw error;
    }
  }

  /** Maps payload participants to entrants/sides and finds the winner. */
  private resolve(
    payload: MatchV5Payload,
    entrantA: string,
    entrantB: string,
    rosterA: readonly RosterMember[],
    rosterB: readonly RosterMember[],
  ): {
    participants: StoredGameParticipant[];
    winnerEntrantId: string;
    unexpected: string[];
  } {
    const byPuuid = new Map<string, { entrantId: string; userId: string; riotAccountId: string }>();
    for (const m of rosterA) byPuuid.set(m.puuid, { entrantId: entrantA, ...m });
    for (const m of rosterB) byPuuid.set(m.puuid, { entrantId: entrantB, ...m });
    const unexpected: string[] = [];
    const participants = payload.info.participants.map((p): StoredGameParticipant => {
      const side = p.teamId === 100 ? ('blue' as const) : ('red' as const);
      const sideEntrant = side === 'blue' ? entrantA : entrantB;
      const known = byPuuid.get(p.puuid);
      if (!known) unexpected.push(p.puuid);
      return {
        entrantId: sideEntrant,
        userId: known?.userId ?? null,
        riotAccountId: known?.riotAccountId ?? null,
        puuid: p.puuid,
        side,
        gameRole: p.teamPosition ? p.teamPosition.toLowerCase() : null,
        championId: p.championId,
        isExpected: known !== undefined && known.entrantId === sideEntrant,
      };
    });
    const winningTeam = payload.info.teams.find((t) => t.win);
    const winnerEntrantId = winningTeam?.teamId === 100 ? entrantA : entrantB;
    return { participants, winnerEntrantId, unexpected };
  }

  /** Scores the series from the recorded games; completes the match when decided. */
  private async maybeCompleteMatch(tournamentId: string, matchId: string): Promise<void> {
    const state = await loadState(this.deps.matches, tournamentId);
    const record = state.matches.find((m) => m.id === matchId);
    if (!record?.entrantA || !record.entrantB) return;
    if (record.status === 'completed' || record.status === 'forfeit') return;
    const games = await this.deps.repo.completedGames(matchId);
    const outcome = resolveSeries({
      format: record.seriesFormat,
      entrantA: record.entrantA,
      entrantB: record.entrantB,
      games: games.map((g) => ({
        number: g.number,
        status: 'completed' as const,
        blue: record.entrantA as string,
        red: record.entrantB as string,
        winner: g.winner === 'a' ? (record.entrantA as string) : (record.entrantB as string),
      })),
    });
    if (!outcome.isComplete || !outcome.winner) return;
    const change = completion(
      this.deps.matches,
      state,
      record,
      { winner: outcome.winner, scoreA: outcome.scoreA, scoreB: outcome.scoreB },
      { source: 'riot_callback', games: null },
    );
    await this.deps.matches.matches.commit(tournamentId, null, compactUpdates(change));
  }
}

/** Admin: the integration status of a tournament. */
export class GetRiotStatusUseCase {
  constructor(private readonly deps: RiotDeps) {}

  async execute(tournamentId: string): Promise<RiotIntegrationStatus> {
    const tournament = await this.deps.tournaments.findById(tournamentId);
    if (!tournament) throw notFound('tournament_not_found');
    const organizationId = await this.deps.organization.id();
    const [setup, counts, recentCallbacks] = await Promise.all([
      this.deps.repo.setupOf(tournamentId),
      this.deps.repo.integrationCounts(tournamentId),
      this.deps.repo.recentCallbacks(organizationId, 10),
    ]);
    return {
      provider: this.deps.settings.provider,
      live: this.deps.settings.live,
      supervision: tournament.config.supervision.level,
      connected: setup !== null,
      region: (setup?.region ?? null) as RiotIntegrationStatus['region'],
      riotTournamentId: setup?.riotTournamentId ?? null,
      codesGenerated: counts.generated,
      codesUsed: counts.used,
      recentCallbacks,
      openIntegrityAlerts: counts.openAlerts,
    };
  }
}

/** Match center / admin: the codes generated for a match. */
export class GetMatchCodesUseCase {
  constructor(private readonly deps: RiotDeps) {}

  async execute(matchId: string): Promise<MatchCodes> {
    const match = await this.deps.matches.matches.find(matchId);
    if (!match) throw notFound('match_not_found');
    const tournament = await this.deps.tournaments.findById(match.tournamentId);
    const automatic = tournament?.config.supervision.level === AUTOMATIC;
    const codes = await this.deps.repo.codesForMatch(matchId);
    return { automatic, codes };
  }
}

/** Match center: the codes for a match, only for a party (captain) of it. */
export class GetMyMatchCodesUseCase {
  constructor(private readonly deps: RiotDeps) {}

  async execute(userId: string, matchId: string): Promise<MatchCodes> {
    const match = await this.deps.matches.matches.find(matchId);
    if (!match) throw notFound('match_not_found');
    const managed = await this.deps.matches.entrants.managedBy(userId, match.tournamentId);
    const party = [match.entrantA, match.entrantB].some((e) => e !== null && managed.has(e));
    if (!party) throw forbidden('not_match_party');
    const tournament = await this.deps.tournaments.findById(match.tournamentId);
    const automatic = tournament?.config.supervision.level === AUTOMATIC;
    return { automatic, codes: await this.deps.repo.codesForMatch(matchId) };
  }
}
