import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_BRAND_COLOR,
  nextMatchEmbed,
  notificationMessage,
  playerEmbed,
  standingsEmbed,
  teamEmbed,
  type EmbedTheme,
} from './embeds.js';
import { DiscordError } from './ports.js';
import { DiscordRestAdapter } from './rest-adapter.js';
import { FakeDiscordAdapter } from './fake-discord-adapter.js';
import { SLASH_COMMANDS } from './commands.js';

const theme: EmbedTheme = { color: DEFAULT_BRAND_COLOR, webOrigin: 'https://penta.gg/' };

describe('embeds', () => {
  it('builds the next-match embed with an absolute link button', () => {
    const msg = nextMatchEmbed(theme, {
      tournamentName: 'Liga Apertura',
      entrantName: 'Jaguares',
      opponentName: 'Quetzales',
      when: 'sáb 25 oct, 20:00',
      phaseName: 'Jornada 3',
      matchPath: '/app/partidas/m1',
    });
    expect(msg.embed?.title).toBe('Jaguares vs Quetzales');
    expect(msg.embed?.color).toBe(DEFAULT_BRAND_COLOR);
    expect(msg.link).toEqual({
      label: 'Abrir centro de partida',
      url: 'https://penta.gg/app/partidas/m1',
    });
    expect(msg.embed?.fields).toHaveLength(2);
  });

  it('says so when there is no next match', () => {
    expect(nextMatchEmbed(theme, null).embed?.title).toBe('Sin partidas próximas');
  });

  it('lists up to ten standings rows and links to the tournament', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      rank: i + 1,
      name: `Equipo ${String(i + 1)}`,
      wins: 12 - i,
      losses: i,
      points: (12 - i) * 3,
    }));
    const msg = standingsEmbed(theme, { tournamentName: 'Liga', slug: 'liga', rows });
    expect(msg.embed?.description?.split('\n')).toHaveLength(10);
    expect(msg.link?.url).toBe('https://penta.gg/torneos/liga');
  });

  it('shows the empty standings message', () => {
    expect(
      standingsEmbed(theme, { tournamentName: 'Liga', slug: 'liga', rows: [] }).embed?.description,
    ).toBe('Todavía no hay posiciones.');
  });

  it('builds a player embed with the fields present', () => {
    const msg = playerEmbed(theme, {
      username: 'ana',
      displayName: 'Ana',
      roles: ['mid'],
      riotId: 'Ana#LAN',
      radar: { aggression: 80, vision: 50 },
      record: { wins: 7, losses: 3 },
      topChampions: ['Ahri', 'Syndra'],
    });
    expect(msg.embed?.title).toBe('Ana');
    const names = msg.embed?.fields?.map((f) => f.name);
    expect(names).toEqual(['Riot ID', 'Roles', 'Récord', 'Radar', 'Campeones']);
    expect(msg.link?.url).toBe('https://penta.gg/jugadores/ana');
  });

  it('omits missing player fields', () => {
    const msg = playerEmbed(theme, {
      username: 'ana',
      displayName: null,
      roles: [],
      riotId: null,
      radar: null,
      record: null,
      topChampions: [],
    });
    expect(msg.embed?.title).toBe('ana');
    expect(msg.embed?.fields).toEqual([]);
  });

  it('builds a team embed', () => {
    const msg = teamEmbed(theme, {
      name: 'Jaguares',
      tag: 'JAG',
      slug: 'jaguares',
      region: 'LAN',
      record: { wins: 5, losses: 1 },
      roster: ['ana', 'beto'],
    });
    expect(msg.embed?.title).toBe('Jaguares [JAG]');
    expect(msg.link?.url).toBe('https://penta.gg/equipos/jaguares');
  });

  it('renders a notification with and without a link', () => {
    const withLink = notificationMessage(theme, {
      subject: 'Inscripción aprobada',
      body: 'Ya estás dentro.',
      path: '/app/torneos/x',
    });
    expect(withLink.embed?.url).toBe('https://penta.gg/app/torneos/x');
    expect(withLink.link?.url).toBe('https://penta.gg/app/torneos/x');
    const noLink = notificationMessage(theme, { subject: 'Hola', body: 'Texto', path: null });
    expect(noLink.embed?.url).toBeUndefined();
    expect(noLink.link).toBeUndefined();
  });
});

/** A minimal stand-in for @discordjs/rest that records calls and returns ids. */
function fakeRest() {
  const calls: { method: string; route: string; body?: unknown }[] = [];
  const rest = {
    post: vi.fn((route: string, opts?: { body?: unknown }) => {
      calls.push({ method: 'post', route, body: opts?.body });
      const id = route.includes('@me/channels')
        ? 'dm-channel'
        : route.includes('/channels') && !route.includes('/messages')
          ? 'voice-1'
          : 'msg-1';
      return Promise.resolve({ id });
    }),
    get: vi.fn(() => Promise.resolve({})),
    put: vi.fn((route: string, opts?: { body?: unknown }) => {
      calls.push({ method: 'put', route, body: opts?.body });
      return Promise.resolve({});
    }),
    delete: vi.fn((route: string) => {
      calls.push({ method: 'delete', route });
      return Promise.resolve({});
    }),
  };
  return { rest, calls };
}

describe('DiscordRestAdapter', () => {
  it('opens a DM channel then posts the embed and button', async () => {
    const { rest, calls } = fakeRest();
    const adapter = new DiscordRestAdapter({ token: 't', rest });
    const result = await adapter.sendDirectMessage('user-1', {
      embed: { title: 'Hola', color: 1 },
      link: { label: 'Abrir', url: 'https://x' },
    });
    expect(result.messageId).toBe('msg-1');
    expect(calls[0]?.route).toContain('/users/@me/channels');
    expect((calls[0]?.body as { recipient_id: string }).recipient_id).toBe('user-1');
    const body = calls[1]?.body as { embeds: unknown[]; components: unknown[] };
    expect(body.embeds).toHaveLength(1);
    expect(body.components).toHaveLength(1);
  });

  it('creates a voice channel under a category and deletes it', async () => {
    const { rest, calls } = fakeRest();
    const adapter = new DiscordRestAdapter({ token: 't', rest });
    const channel = await adapter.createVoiceChannel('guild-1', 'Partida', { parentId: 'cat-1' });
    expect(channel.channelId).toBe('voice-1');
    const body = calls[0]?.body as { type: number; parent_id: string };
    expect(body.type).toBe(2); // GuildVoice
    expect(body.parent_id).toBe('cat-1');
    await adapter.deleteChannel('voice-1');
    expect(calls.at(-1)).toMatchObject({ method: 'delete' });
  });

  it('registers the guild commands', async () => {
    const { rest, calls } = fakeRest();
    const adapter = new DiscordRestAdapter({ token: 't', rest });
    await adapter.setGuildCommands('app-1', 'guild-1', SLASH_COMMANDS);
    const body = calls[0]?.body as { name: string }[];
    expect(body.map((c) => c.name)).toContain('checkin');
    expect(calls[0]?.route).toContain('/applications/app-1/guilds/guild-1/commands');
  });

  it('maps a closed-DM error (code 50007) to cannot_dm', async () => {
    const { rest } = fakeRest();
    rest.post.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 403, code: 50007 }));
    const adapter = new DiscordRestAdapter({ token: 't', rest });
    await expect(
      adapter.sendDirectMessage('u', { embed: { title: 'x', color: 1 } }),
    ).rejects.toMatchObject({ name: 'DiscordError', kind: 'cannot_dm' });
  });

  it('maps 429 to a retryable error and 401 to a fatal one', async () => {
    const { rest } = fakeRest();
    const adapter = new DiscordRestAdapter({ token: 't', rest });
    rest.post.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 429 }));
    await expect(
      adapter.sendChannelMessage('c', { embed: { title: 'x', color: 1 } }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof DiscordError && e.kind === 'rate_limited' && e.retryable,
    );
    rest.post.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }));
    await expect(
      adapter.sendChannelMessage('c', { embed: { title: 'x', color: 1 } }),
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof DiscordError && e.kind === 'unauthorized' && !e.retryable,
    );
  });
});

describe('FakeDiscordAdapter', () => {
  it('records messages, channels and roles', async () => {
    const fake = new FakeDiscordAdapter();
    await fake.sendDirectMessage('u1', { embed: { title: 'a', color: 1 } });
    await fake.sendChannelMessage('c1', { embed: { title: 'b', color: 1 } });
    const { channelId } = await fake.createVoiceChannel('g1', 'Partida', { parentId: 'cat' });
    await fake.deleteChannel(channelId);
    await fake.addRole('g1', 'u1', 'role-verified');
    expect(fake.dms).toHaveLength(1);
    expect(fake.channelMessages[0]?.channelId).toBe('c1');
    expect(fake.deletedChannels).toEqual([channelId]);
    expect(fake.rolesAdded[0]?.roleId).toBe('role-verified');
  });

  it('fails the next call when asked', async () => {
    const fake = new FakeDiscordAdapter();
    fake.failNext(new DiscordError('cannot_dm'));
    await expect(
      fake.sendDirectMessage('u', { embed: { title: 'x', color: 1 } }),
    ).rejects.toBeInstanceOf(DiscordError);
    // Only the next call fails.
    await expect(
      fake.sendDirectMessage('u', { embed: { title: 'x', color: 1 } }),
    ).resolves.toBeDefined();
  });
});
