// What the Discord use cases need from the database (the guild config, channel
// mappings, temp-channel bookkeeping and the user↔Discord link). Business reads
// for the bot commands come from the existing query services (deps.ts).

import type { DiscordChannelPurpose, DiscordFeature } from '@league/contracts';

export interface GuildConfig {
  readonly guildId: string;
  readonly guildName: string | null;
  readonly features: Partial<Record<DiscordFeature, boolean>>;
  readonly verifiedRoleId: string | null;
  readonly roleByTournament: Readonly<Record<string, string>>;
  readonly channels: readonly {
    readonly purpose: DiscordChannelPurpose;
    readonly channelId: string;
    readonly tournamentId: string | null;
  }[];
}

export interface DiscordDirectory {
  /** The guild connected for the organization, or null. */
  guildConfig(organizationId: string): Promise<GuildConfig | null>;
  /** Discord id of a platform user (manual link or Discord sign-in). */
  discordIdOf(userId: string): Promise<string | null>;
  /** Platform user a Discord id belongs to, or null if not linked. */
  userIdByDiscordId(discordUserId: string): Promise<string | null>;
  /** The channel mapped to a purpose (tournament-scoped first, then the guild default). */
  channelIdFor(
    organizationId: string,
    purpose: DiscordChannelPurpose,
    tournamentId: string | null,
  ): Promise<string | null>;
  saveGuild(
    organizationId: string,
    actorId: string,
    input: {
      readonly guildId: string;
      readonly guildName: string | null;
      readonly settings: Record<string, unknown>;
    },
  ): Promise<void>;
  setChannel(
    organizationId: string,
    actorId: string,
    purpose: DiscordChannelPurpose,
    channelId: string | null,
    tournamentId: string | null,
  ): Promise<void>;
  recordTempChannel(
    guildRowId: string,
    matchId: string,
    entrantId: string | null,
    channelId: string,
  ): Promise<void>;
  /** Marks a match's temp channels deleted and returns the channel ids to remove. */
  closeTempChannels(matchId: string): Promise<string[]>;
  /** The internal id of the guild row (for temp-channel bookkeeping). */
  guildRowId(organizationId: string): Promise<string | null>;
  linkUser(userId: string, discordUserId: string, discordUsername: string | null): Promise<void>;
  /** Matches that just entered check-in (need voice) and ended ones with open channels. */
  voiceWork(organizationId: string): Promise<{
    readonly toOpen: readonly {
      readonly matchId: string;
      readonly entrants: readonly { readonly entrantId: string; readonly name: string }[];
    }[];
    readonly toClose: readonly string[];
  }>;
}
