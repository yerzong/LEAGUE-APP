import type { BotReply } from '@league/contracts';
import { describe, expect, it, vi } from 'vitest';

import { BotApiClient } from './api-client.js';
import { resolveConfig } from './config.js';
import { dispatchCommand, type CommandInvocation } from './dispatch.js';
import { toReplyOptions } from './reply.js';

const FULL = {
  DISCORD_BOT_TOKEN: 'token',
  DISCORD_CLIENT_ID: 'client',
  DISCORD_GUILD_ID: 'guild',
  DISCORD_BOT_API_SECRET: 'a'.repeat(16),
  API_URL: 'http://localhost:4000/',
};

describe('resolveConfig (startup guard)', () => {
  it('returns the config when fully set, trimming the API url', () => {
    const { config, reason } = resolveConfig(FULL);
    expect(reason).toBeNull();
    expect(config).toEqual({
      token: 'token',
      clientId: 'client',
      guildId: 'guild',
      apiSecret: 'a'.repeat(16),
      apiUrl: 'http://localhost:4000',
    });
  });

  it('stays disabled (no throw) when the token is missing, naming what is missing', () => {
    const { config, reason } = resolveConfig({ ...FULL, DISCORD_BOT_TOKEN: undefined });
    expect(config).toBeNull();
    expect(reason).toContain('DISCORD_BOT_TOKEN');
  });

  it('stays disabled with an empty environment', () => {
    expect(resolveConfig({}).config).toBeNull();
  });
});

describe('BotApiClient', () => {
  const reply: BotReply = { embed: { title: 'Hola', color: 1 }, ephemeral: false };

  function client(impl: typeof fetch) {
    return new BotApiClient({ apiUrl: 'http://api', apiSecret: 'secret', fetch: impl });
  }

  it('posts to the right endpoint with the bot secret and the actor', async () => {
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['x-bot-secret']).toBe('secret');
      return Promise.resolve(Response.json(reply));
    }) as unknown as typeof fetch;
    const result = await client(fetchFn).standings({ discordUserId: '123' }, 'Liga');
    expect(result.embed?.title).toBe('Hola');
    const call = vi.mocked(fetchFn).mock.calls[0];
    expect(call?.[0]).toBe('http://api/bot/standings');
    const body = call?.[1]?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '{}')).toEqual({
      discordUserId: '123',
      tournament: 'Liga',
    });
  });

  it('falls back to an ephemeral error when the API fails', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response('nope', { status: 500 })),
    ) as unknown as typeof fetch;
    const result = await client(fetchFn).nextMatch({ discordUserId: '1' });
    expect(result.ephemeral).toBe(true);
    expect(result.content).toContain('No pude procesar');
  });

  it('falls back when fetch throws', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error('down'))) as unknown as typeof fetch;
    expect((await client(fetchFn).checkin({ discordUserId: '1' })).content).toContain('No pude');
  });

  it('only sends targetDiscordUserId when present', async () => {
    const bodies: unknown[] = [];
    const fetchFn = vi.fn((_u: string, init?: RequestInit) => {
      bodies.push(JSON.parse(init?.body as string));
      return Promise.resolve(Response.json(reply));
    }) as unknown as typeof fetch;
    const c = client(fetchFn);
    await c.player({ discordUserId: '1' });
    await c.player({ discordUserId: '1' }, '999');
    expect(bodies[0]).toEqual({ discordUserId: '1' });
    expect(bodies[1]).toEqual({ discordUserId: '1', targetDiscordUserId: '999' });
  });
});

describe('dispatchCommand', () => {
  const api = {
    nextMatch: vi.fn(() => Promise.resolve({ content: 'next', ephemeral: false })),
    checkin: vi.fn(() => Promise.resolve({ content: 'checkin', ephemeral: false })),
    standings: vi.fn(() => Promise.resolve({ content: 'tabla', ephemeral: false })),
    player: vi.fn(() => Promise.resolve({ content: 'perfil', ephemeral: false })),
    team: vi.fn(() => Promise.resolve({ content: 'equipo', ephemeral: false })),
    link: vi.fn(() => Promise.resolve({ content: 'vincular', ephemeral: false })),
  } as unknown as BotApiClient;

  const invocation = (
    commandName: string,
    strings: Record<string, string> = {},
    users: Record<string, string> = {},
  ): CommandInvocation => ({
    commandName,
    actor: { discordUserId: '123', discordUsername: 'ana' },
    getString: (name) => strings[name] ?? null,
    getUserId: (name) => users[name] ?? null,
  });

  it('routes each command to its API call', async () => {
    expect((await dispatchCommand(api, invocation('proximo'))).content).toBe('next');
    expect((await dispatchCommand(api, invocation('checkin'))).content).toBe('checkin');
    expect((await dispatchCommand(api, invocation('tabla', { torneo: 'Liga' }))).content).toBe(
      'tabla',
    );
    expect((await dispatchCommand(api, invocation('perfil', {}, { usuario: '999' }))).content).toBe(
      'perfil',
    );
    expect((await dispatchCommand(api, invocation('vincular'))).content).toBe('vincular');
  });

  it('passes the mentioned user to /perfil', async () => {
    await dispatchCommand(api, invocation('perfil', {}, { usuario: '999' }));
    // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on the vi.fn, not calling it.
    expect(api.player).toHaveBeenLastCalledWith(
      { discordUserId: '123', discordUsername: 'ana' },
      '999',
    );
  });

  it('requires the torneo and nombre arguments', async () => {
    expect((await dispatchCommand(api, invocation('tabla'))).content).toContain('Falta');
    expect((await dispatchCommand(api, invocation('equipo'))).content).toContain('Falta');
  });

  it('rejects an unknown command', async () => {
    expect((await dispatchCommand(api, invocation('otro'))).content).toBe('Comando no reconocido.');
  });
});

describe('toReplyOptions', () => {
  it('builds an embed with a link button and keeps it ephemeral', () => {
    const options = toReplyOptions({
      embed: {
        title: 'Jaguares vs Quetzales',
        color: 0xc8cdd6,
        fields: [{ name: 'Fase', value: 'J1' }],
      },
      link: { label: 'Abrir', url: 'https://penta.gg/app/partidas/m1' },
      ephemeral: true,
    });
    expect(options.embeds).toHaveLength(1);
    expect(options.components).toHaveLength(1);
    expect(options.flags).toBe(1 << 6);
  });

  it('plain content without embed or button', () => {
    const options = toReplyOptions({ content: 'Hola', ephemeral: false });
    expect(options.content).toBe('Hola');
    expect(options.embeds).toBeUndefined();
    expect(options.components).toBeUndefined();
    expect(options.flags).toBeUndefined();
  });
});
