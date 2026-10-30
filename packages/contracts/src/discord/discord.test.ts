import { describe, expect, it } from 'vitest';

import {
  BotReplySchema,
  BotStandingsRequestSchema,
  DiscordConfigSchema,
  SaveDiscordGuildRequestSchema,
  SetDiscordChannelRequestSchema,
} from './discord.js';

describe('admin config', () => {
  it('accepts a connected config with features and channels', () => {
    const parsed = DiscordConfigSchema.parse({
      guildId: '123456789',
      guildName: 'PENTA',
      connected: true,
      botReady: true,
      features: { checkin: true, voiceChannels: false },
      channels: [{ purpose: 'staff', channelId: '555000111' }],
      verifiedRoleId: null,
    });
    expect(parsed.features.checkin).toBe(true);
    expect(parsed.channels[0]?.purpose).toBe('staff');
  });

  it('rejects a non-numeric guild id', () => {
    expect(SaveDiscordGuildRequestSchema.safeParse({ guildId: 'abc', features: {} }).success).toBe(
      false,
    );
  });

  it('a channel mapping may be cleared with null', () => {
    expect(SetDiscordChannelRequestSchema.parse({ purpose: 'results', channelId: null })).toEqual({
      purpose: 'results',
      channelId: null,
    });
  });

  it('rejects an unknown feature or purpose', () => {
    expect(
      SaveDiscordGuildRequestSchema.safeParse({ guildId: '1'.repeat(6), features: { nope: true } })
        .success,
    ).toBe(false);
    expect(
      SetDiscordChannelRequestSchema.safeParse({ purpose: 'random', channelId: null }).success,
    ).toBe(false);
  });
});

describe('bot requests and replies', () => {
  it('carries the invoking Discord id and validates it', () => {
    expect(
      BotStandingsRequestSchema.parse({ discordUserId: '123456', tournament: 'Liga Apertura' })
        .tournament,
    ).toBe('Liga Apertura');
    expect(
      BotStandingsRequestSchema.safeParse({ discordUserId: 'x', tournament: 'a' }).success,
    ).toBe(false);
  });

  it('a reply defaults to non-ephemeral', () => {
    expect(BotReplySchema.parse({ embed: { title: 'Hola', color: 1 } }).ephemeral).toBe(false);
  });
});
