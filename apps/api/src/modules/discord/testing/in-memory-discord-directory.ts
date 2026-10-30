// In-memory DiscordDirectory for the use-case tests.

import type { DiscordChannelPurpose } from '@league/contracts';

import type { DiscordDirectory, GuildConfig } from '../application/ports.js';

export class InMemoryDiscordDirectory implements DiscordDirectory {
  guild: GuildConfig | null = null;
  links = new Map<string, string>(); // discordUserId → userId
  reverse = new Map<string, string>(); // userId → discordUserId
  temp: { guildRowId: string; matchId: string; entrantId: string | null; channelId: string }[] = [];
  voice: Awaited<ReturnType<DiscordDirectory['voiceWork']>> = { toOpen: [], toClose: [] };
  guildRow = 'guild-row-1';

  guildConfig(): Promise<GuildConfig | null> {
    return Promise.resolve(this.guild);
  }
  discordIdOf(userId: string): Promise<string | null> {
    return Promise.resolve(this.reverse.get(userId) ?? null);
  }
  userIdByDiscordId(discordUserId: string): Promise<string | null> {
    return Promise.resolve(this.links.get(discordUserId) ?? null);
  }
  channelIdFor(_org: string, purpose: DiscordChannelPurpose): Promise<string | null> {
    const link = this.guild?.channels.find((c) => c.purpose === purpose);
    return Promise.resolve(link?.channelId ?? null);
  }
  saveGuild(): Promise<void> {
    return Promise.resolve();
  }
  setChannel(): Promise<void> {
    return Promise.resolve();
  }
  recordTempChannel(
    guildRowId: string,
    matchId: string,
    entrantId: string | null,
    channelId: string,
  ): Promise<void> {
    this.temp.push({ guildRowId, matchId, entrantId, channelId });
    return Promise.resolve();
  }
  closeTempChannels(matchId: string): Promise<string[]> {
    const ids = this.temp.filter((t) => t.matchId === matchId).map((t) => t.channelId);
    this.temp = this.temp.filter((t) => t.matchId !== matchId);
    return Promise.resolve(ids);
  }
  guildRowId(): Promise<string | null> {
    return Promise.resolve(this.guild ? this.guildRow : null);
  }
  linkUser(userId: string, discordUserId: string): Promise<void> {
    this.links.set(discordUserId, userId);
    this.reverse.set(userId, discordUserId);
    return Promise.resolve();
  }
  voiceWork(): Promise<Awaited<ReturnType<DiscordDirectory['voiceWork']>>> {
    return Promise.resolve(this.voice);
  }

  // Test helper: link a user both ways.
  link(discordUserId: string, userId: string): void {
    this.links.set(discordUserId, userId);
    this.reverse.set(userId, discordUserId);
  }
}
