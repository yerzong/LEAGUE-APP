// Postgres adapter of RiotRepository: the Riot provider/tournament/codes, the
// inbound webhook log, integrity alerts and the frozen roster. Writes go through
// the svc_* functions; reads use the secret key (server side only).

import type { Json } from '@league/db';
import type { TeamSize } from '@league/integrations';

import { assertNoError } from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type {
  CallbackLog,
  CodeContext,
  CodeView,
  RiotRepository,
  RiotSetup,
  RosterMember,
  StoredGameParticipant,
} from '../application/ports.js';

export class SupabaseRiotRepository implements RiotRepository {
  constructor(private readonly db: AdminClient) {}

  async setupOf(tournamentId: string): Promise<RiotSetup | null> {
    const { data, error } = await this.db
      .from('riot_tournaments')
      .select('riot_tournament_id, riot_providers!inner(id, riot_provider_id, region)')
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const provider = data.riot_providers as unknown as {
      id: string;
      riot_provider_id: number;
      region: string;
    };
    return {
      providerRowId: provider.id,
      riotProviderId: provider.riot_provider_id,
      riotTournamentId: data.riot_tournament_id,
      region: provider.region,
    };
  }

  async saveProvider(
    organizationId: string,
    actorId: string,
    region: string,
    riotProviderId: number,
    callbackUrl: string,
  ): Promise<string> {
    const { data, error } = await this.db.rpc('svc_save_riot_provider', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_region: region as never,
      p_provider_id: riotProviderId,
      p_callback_url: callbackUrl,
    });
    assertNoError(error);
    return data as string;
  }

  async saveTournament(
    tournamentId: string,
    providerRowId: string,
    riotTournamentId: number,
    name: string,
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_save_riot_tournament', {
      p_tournament_id: tournamentId,
      p_provider: providerRowId,
      p_riot_tournament_id: riotTournamentId,
      p_name: name,
    });
    assertNoError(error);
  }

  async openGame(
    matchId: string,
    gameNumber: number,
    blueEntrant: string,
    redEntrant: string,
  ): Promise<string> {
    const { data, error } = await this.db.rpc('svc_open_riot_game', {
      p_match_id: matchId,
      p_game_number: gameNumber,
      p_blue: blueEntrant,
      p_red: redEntrant,
    });
    assertNoError(error);
    return data as string;
  }

  async saveCode(input: {
    gameId: string;
    riotTournamentId: number;
    code: string;
    allowedPuuids: readonly string[];
    teamSize: TeamSize;
    map: string;
    pickType: string;
    spectatorType: string;
    metadata: string;
  }): Promise<void> {
    const { error } = await this.db.rpc('svc_save_tournament_code', {
      p_game_id: input.gameId,
      p_riot_tournament_id: input.riotTournamentId,
      p_code: input.code,
      p_allowed_puuids: [...input.allowedPuuids],
      p_team_size: input.teamSize,
      p_map: input.map,
      p_pick_type: input.pickType,
      p_spectator_type: input.spectatorType,
      p_metadata: input.metadata,
    });
    assertNoError(error);
  }

  async rosterOf(entrantId: string): Promise<RosterMember[]> {
    const { data, error } = await this.db
      .from('entrant_roster_members')
      .select('user_id, roster_role, riot_accounts!inner(id, puuid)')
      .eq('entrant_id', entrantId)
      .is('removed_at', null)
      .neq('roster_role', 'coach');
    assertNoError(error);
    return (data ?? []).flatMap((row) => {
      const account = row.riot_accounts as unknown as { id: string; puuid: string } | null;
      if (!account) return [];
      return [{ userId: row.user_id, puuid: account.puuid, riotAccountId: account.id }];
    });
  }

  async codeContext(shortCode: string): Promise<CodeContext | null> {
    const { data, error } = await this.db
      .from('riot_tournament_codes')
      .select('game_id, metadata, games!inner(match_id, game_number, matches!inner(tournament_id))')
      .eq('code', shortCode)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    const game = data.games;
    return {
      gameId: data.game_id,
      matchId: game.match_id,
      tournamentId: game.matches.tournament_id,
      gameNumber: game.game_number,
      metadata: data.metadata,
    };
  }

  async logWebhook(
    organizationId: string | null,
    source: string,
    eventType: string,
    idempotencyKey: string,
    payload: unknown,
    signatureValid: boolean,
  ): Promise<boolean> {
    const { data, error } = await this.db.rpc('svc_log_inbound_webhook', {
      p_organization_id: organizationId as never,
      p_source: source,
      p_event_type: eventType,
      p_idempotency_key: idempotencyKey,
      p_payload: payload as Json,
      p_signature_valid: signatureValid,
    });
    assertNoError(error);
    return data as boolean;
  }

  async markWebhook(
    source: string,
    idempotencyKey: string,
    status: 'processed' | 'failed' | 'skipped',
    error: string | null,
  ): Promise<void> {
    const { error: rpcError } = await this.db.rpc('svc_mark_webhook', {
      p_source: source,
      p_idempotency_key: idempotencyKey,
      p_status: status,
      p_error: error as never,
    });
    assertNoError(rpcError);
  }

  async recordGame(input: {
    gameId: string;
    winnerEntrantId: string;
    payload: unknown;
    durationSeconds: number;
    patch: string | null;
    riotMatchId: string;
    participants: readonly StoredGameParticipant[];
  }): Promise<void> {
    const { error } = await this.db.rpc('svc_record_riot_game', {
      p_game_id: input.gameId,
      p_winner: input.winnerEntrantId,
      p_payload: input.payload as Json,
      p_duration: input.durationSeconds,
      p_patch: input.patch as never,
      p_riot_match_id: input.riotMatchId,
      p_participants: input.participants.map((p) => ({
        entrant_id: p.entrantId,
        user_id: p.userId,
        riot_account_id: p.riotAccountId,
        puuid: p.puuid,
        side: p.side,
        game_role: p.gameRole,
        champion_id: p.championId,
        is_expected: p.isExpected,
      })) as unknown as Json,
      p_draft: [] as unknown as Json,
    });
    assertNoError(error);
  }

  async raiseIntegrityAlert(input: {
    organizationId: string;
    type: 'roster_mismatch';
    severity: number;
    subjectId: string;
    evidence: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    const { error } = await this.db.rpc('svc_raise_integrity_alert', {
      p_organization_id: input.organizationId,
      p_type: input.type,
      p_severity: input.severity,
      p_subject_type: 'game',
      p_subject_id: input.subjectId,
      p_evidence: input.evidence as Json,
    });
    assertNoError(error);
  }

  async completedGames(matchId: string): Promise<{ number: number; winner: 'a' | 'b' }[]> {
    const { data, error } = await this.db
      .from('games')
      .select('game_number, status, winner_entrant_id, matches!inner(entrant_a_id)')
      .eq('match_id', matchId)
      .eq('status', 'completed');
    assertNoError(error);
    return (data ?? []).flatMap((g) => {
      if (!g.winner_entrant_id) return [];
      const entrantA = (g.matches).entrant_a_id;
      return [{ number: g.game_number, winner: g.winner_entrant_id === entrantA ? 'a' : 'b' }];
    });
  }

  async codesForMatch(matchId: string): Promise<CodeView[]> {
    const { data, error } = await this.db
      .from('riot_tournament_codes')
      .select(
        'code, status, team_size, allowed_puuids, generated_at, used_at, games!inner(match_id, game_number)',
      )
      .eq('games.match_id', matchId)
      .order('generated_at', { ascending: true });
    assertNoError(error);
    return (data ?? []).map((c) => ({
      gameNumber: (c.games as unknown as { game_number: number }).game_number,
      code: c.code,
      status: c.status,
      teamSize: c.team_size,
      allowedCount: c.allowed_puuids.length,
      generatedAt: c.generated_at,
      usedAt: c.used_at,
    }));
  }

  async integrationCounts(
    tournamentId: string,
  ): Promise<{ generated: number; used: number; openAlerts: number }> {
    const codes = await this.db
      .from('riot_tournament_codes')
      .select('status, games!inner(matches!inner(tournament_id))', { count: 'exact', head: false })
      .eq('games.matches.tournament_id', tournamentId);
    assertNoError(codes.error);
    const rows = codes.data ?? [];
    const used = rows.filter((r) => r.status === 'used').length;
    const alerts = await this.db
      .from('integrity_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open');
    assertNoError(alerts.error);
    return { generated: rows.length, used, openAlerts: alerts.count ?? 0 };
  }

  async recentCallbacks(organizationId: string, limit: number): Promise<CallbackLog[]> {
    const { data, error } = await this.db
      .from('inbound_webhooks')
      .select('event_type, status, received_at, error')
      .eq('organization_id', organizationId)
      .eq('source', 'riot')
      .order('received_at', { ascending: false })
      .limit(limit);
    assertNoError(error);
    return (data ?? []).map((w) => ({
      eventType: w.event_type,
      status: w.status === 'received' ? 'received' : w.status,
      receivedAt: w.received_at,
      error: w.error,
    }));
  }
}
