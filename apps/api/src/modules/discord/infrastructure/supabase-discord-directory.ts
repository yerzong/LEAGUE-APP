// Postgres adapter of DiscordDirectory: the guild config, channel mappings,
// temp-channel bookkeeping and the user↔Discord link. Writes go through the
// svc_* functions (audited); reads apply no RLS (secret key, server side).

import type { DiscordChannelPurpose, DiscordFeature } from '@league/contracts';
import type { Json } from '@league/db';

import { assertNoError } from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type { DiscordDirectory, GuildConfig } from '../application/ports.js';

interface GuildSettings {
  features?: Partial<Record<DiscordFeature, boolean>>;
  roles?: { verified?: string | null; byTournament?: Record<string, string> };
}

export class SupabaseDiscordDirectory implements DiscordDirectory {
  constructor(private readonly db: AdminClient) {}

  async guildConfig(organizationId: string): Promise<GuildConfig | null> {
    const { data: guild, error } = await this.db
      .from('discord_guilds')
      .select('id, guild_id, name, settings')
      .eq('organization_id', organizationId)
      .maybeSingle();
    assertNoError(error);
    if (!guild) return null;
    const settings = (guild.settings ?? {}) as GuildSettings;
    const { data: links, error: linksError } = await this.db
      .from('discord_channel_links')
      .select('purpose, channel_id, tournament_id')
      .eq('guild_id', guild.id);
    assertNoError(linksError);
    return {
      guildId: guild.guild_id,
      guildName: guild.name,
      features: settings.features ?? {},
      verifiedRoleId: settings.roles?.verified ?? null,
      roleByTournament: settings.roles?.byTournament ?? {},
      channels: (links ?? []).map((l) => ({
        purpose: l.purpose,
        channelId: l.channel_id,
        tournamentId: l.tournament_id,
      })),
    };
  }

  async discordIdOf(userId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('user_discord_links')
      .select('discord_user_id')
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error);
    return data?.discord_user_id ?? null;
  }

  async userIdByDiscordId(discordUserId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('user_discord_links')
      .select('user_id')
      .eq('discord_user_id', discordUserId)
      .maybeSingle();
    assertNoError(error);
    return data?.user_id ?? null;
  }

  async channelIdFor(
    organizationId: string,
    purpose: DiscordChannelPurpose,
    tournamentId: string | null,
  ): Promise<string | null> {
    const config = await this.guildConfig(organizationId);
    if (!config) return null;
    const scoped = config.channels.find(
      (c) => c.purpose === purpose && c.tournamentId === tournamentId,
    );
    const fallback = config.channels.find((c) => c.purpose === purpose && c.tournamentId === null);
    return (scoped ?? fallback)?.channelId ?? null;
  }

  async saveGuild(
    organizationId: string,
    actorId: string,
    input: { guildId: string; guildName: string | null; settings: Record<string, unknown> },
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_save_discord_guild', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_guild_id: input.guildId,
      p_name: input.guildName as string,
      p_settings: input.settings as Json,
    });
    assertNoError(error);
  }

  async setChannel(
    organizationId: string,
    actorId: string,
    purpose: DiscordChannelPurpose,
    channelId: string | null,
    tournamentId: string | null,
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_set_discord_channel', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_purpose: purpose,
      p_channel_id: channelId as string,
      p_tournament_id: tournamentId as string,
    });
    assertNoError(error);
  }

  async recordTempChannel(
    guildRowId: string,
    matchId: string,
    entrantId: string | null,
    channelId: string,
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_record_temp_channel', {
      p_guild_id: guildRowId,
      p_match_id: matchId,
      p_entrant_id: entrantId as string,
      p_channel_id: channelId,
    });
    assertNoError(error);
  }

  async closeTempChannels(matchId: string): Promise<string[]> {
    const { data, error } = await this.db.rpc('svc_close_temp_channels', { p_match_id: matchId });
    assertNoError(error);
    return data ?? [];
  }

  async guildRowId(organizationId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('discord_guilds')
      .select('id')
      .eq('organization_id', organizationId)
      .maybeSingle();
    assertNoError(error);
    return data?.id ?? null;
  }

  async linkUser(
    userId: string,
    discordUserId: string,
    discordUsername: string | null,
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_link_discord_user', {
      p_user_id: userId,
      p_discord_user_id: discordUserId,
      p_discord_username: discordUsername as string,
    });
    assertNoError(error);
  }

  async voiceWork(organizationId: string): Promise<{
    toOpen: { matchId: string; entrants: { entrantId: string; name: string }[] }[];
    toClose: string[];
  }> {
    const guildRowId = await this.guildRowId(organizationId);
    if (!guildRowId) return { toOpen: [], toClose: [] };

    // Open: matches in check-in with no temp channel rows yet.
    const { data: checkinMatches, error: openError } = await this.db
      .from('matches')
      .select('id, entrant_a_id, entrant_b_id')
      .eq('status', 'checkin');
    assertNoError(openError);
    const checkinIds = (checkinMatches ?? []).map((m) => m.id);
    const existing = new Set<string>();
    if (checkinIds.length > 0) {
      const { data: temp, error: tempError } = await this.db
        .from('discord_temp_channels')
        .select('match_id')
        .in('match_id', checkinIds);
      assertNoError(tempError);
      for (const t of temp ?? []) existing.add(t.match_id);
    }
    const openTargets = (checkinMatches ?? []).filter((m) => !existing.has(m.id));
    const entrantIds = [
      ...new Set(
        openTargets.flatMap((m) =>
          [m.entrant_a_id, m.entrant_b_id].filter((id): id is string => id !== null),
        ),
      ),
    ];
    const names = new Map<string, string>();
    if (entrantIds.length > 0) {
      const { data: entrants, error: entrantsError } = await this.db
        .from('entrants')
        .select('id, display_name')
        .in('id', entrantIds);
      assertNoError(entrantsError);
      for (const e of entrants ?? []) names.set(e.id, e.display_name);
    }
    const toOpen = openTargets.map((m) => ({
      matchId: m.id,
      entrants: [m.entrant_a_id, m.entrant_b_id]
        .filter((id): id is string => id !== null)
        .map((id) => ({ entrantId: id, name: names.get(id) ?? 'Equipo' })),
    }));

    // Close: open temp channels whose match is no longer live.
    const { data: open, error: closeError } = await this.db
      .from('discord_temp_channels')
      .select('match_id, matches!inner(status)')
      .is('deleted_at', null);
    assertNoError(closeError);
    const toClose = [
      ...new Set(
        (open ?? [])
          .filter((row) => {
            const status = (row.matches as unknown as { status: string } | null)?.status;
            return status !== 'checkin' && status !== 'ready' && status !== 'live';
          })
          .map((row) => row.match_id),
      ),
    ];
    return { toOpen, toClose };
  }
}
