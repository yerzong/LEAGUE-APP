import type { MyMatch, PublicPlayer, PublicTeam, TournamentBoard } from '@league/contracts';
import { DEFAULT_BRAND_COLOR, FakeDiscordAdapter } from '@league/integrations';
import { describe, expect, it, beforeEach } from 'vitest';

import { DiscordChannelAdapter } from '../infrastructure/discord-channel.js';
import type { DeliveryRecord } from '../../notifications/domain/notification.js';
import { InMemoryDiscordDirectory } from '../testing/in-memory-discord-directory.js';
import type { DiscordDeps } from './deps.js';
import {
  AssignVerifiedRoleUseCase,
  BotCheckinUseCase,
  BotLinkUseCase,
  BotNextMatchUseCase,
  BotPlayerUseCase,
  BotStandingsUseCase,
  BotTeamUseCase,
  CloseMatchVoiceUseCase,
  CreateMatchVoiceUseCase,
  GetDiscordConfigUseCase,
  ReconcileMatchVoiceUseCase,
} from './discord.use-cases.js';

const theme = { color: DEFAULT_BRAND_COLOR, webOrigin: 'https://penta.gg' };
const NOW = new Date('2026-10-24T20:00:00.000Z');

function makeDeps(over: Partial<{ matches: MyMatch[] }> = {}) {
  const directory = new InMemoryDiscordDirectory();
  const discord = new FakeDiscordAdapter();
  const checkedIn: string[] = [];
  const deps = {
    directory,
    discord,
    botReady: true,
    theme,
    organization: { id: () => Promise.resolve('org-1') },
    clock: { now: () => NOW },
    profiles: {
      findById: (id: string) =>
        Promise.resolve(
          id === 'user-ana'
            ? { username: 'ana', displayName: 'Ana', platformRole: 'user' }
            : id === 'admin'
              ? { username: 'adm', displayName: 'Admin', platformRole: 'super_admin' }
              : null,
        ),
    },
    tournaments: {
      findBySlug: (slug: string) =>
        Promise.resolve(
          slug === 'liga' ? { slug: 'liga', config: { basics: { name: 'Liga Apertura' } } } : null,
        ),
    },
    queries: {
      myMatches: { execute: () => Promise.resolve(over.matches ?? []) },
      checkIn: {
        execute: (_userId: string, matchId: string) => {
          checkedIn.push(matchId);
          return Promise.resolve({});
        },
      },
      board: {
        execute: (slug: string): Promise<TournamentBoard> =>
          Promise.resolve({
            tournamentId: 't1',
            status: 'in_progress',
            timezone: 'America/Mexico_City',
            phases: [
              {
                id: 'p1',
                name: 'Liga',
                position: 1,
                format: 'round_robin',
                seriesFormat: 'bo1',
                status: 'in_progress',
                groups: [
                  {
                    id: null,
                    name: null,
                    standings: [
                      {
                        entrant: {
                          id: 'e1',
                          displayName: 'Jaguares',
                          displayTag: null,
                          logoUrl: null,
                          teamSlug: null,
                          seed: null,
                        },
                        rank: 1,
                        points: 9,
                        played: 3,
                        wins: 3,
                        losses: 0,
                        draws: 0,
                        gameWins: 6,
                        gameLosses: 1,
                        gameDiff: 5,
                        status: 'qualified',
                        tiebreaks: [],
                        tiedWith: [],
                      },
                    ],
                  },
                ],
                matches: [],
                tiebreakRequired: false,
              },
            ],
            champion: null,
            canGenerateFixtures: false,
            ...(slug === 'liga' ? {} : {}),
          }),
      },
      player: {
        execute: (username: string): Promise<PublicPlayer> =>
          Promise.resolve({
            username,
            displayName: 'Ana',
            avatarUrl: null,
            bio: null,
            countryCode: null,
            gameRegion: null,
            primaryRole: 'mid',
            secondaryRole: null,
            isAdult: null,
            riotAccount: { gameName: 'Ana', tagLine: 'LAN', region: 'la1' },
            teams: [],
            socialLinks: [],
          }),
      },
      team: {
        execute: (slug: string): Promise<PublicTeam> =>
          slug === 'jaguares'
            ? Promise.resolve({
                id: 't',
                slug: 'jaguares',
                name: 'Jaguares',
                tag: 'JAG',
                region: 'la1',
                logoUrl: null,
                description: null,
                status: 'active',
                createdAt: NOW.toISOString(),
                members: [
                  {
                    username: 'ana',
                    displayName: 'Ana',
                    avatarUrl: null,
                    teamRole: 'captain',
                    primaryRole: 'mid',
                    riotId: null,
                  },
                ],
              })
            : Promise.reject(new Error('not found')),
      },
    },
  } as unknown as DiscordDeps;
  return { deps, directory, discord, checkedIn };
}

const match = (over: Partial<MyMatch> = {}): MyMatch => ({
  id: 'm1',
  tournamentId: 't1',
  phaseId: 'p1',
  phaseName: 'Jornada 1',
  groupName: null,
  bracketKey: 'r1-m1',
  round: 1,
  position: 1,
  bracketSide: null,
  seriesFormat: 'bo1',
  draftMode: 'standard',
  status: 'scheduled',
  scheduledAt: '2026-10-25T02:00:00.000Z',
  checkinOpensAt: null,
  checkinClosesAt: null,
  entrantA: {
    id: 'e1',
    displayName: 'Jaguares',
    displayTag: null,
    logoUrl: null,
    teamSlug: null,
    seed: null,
  },
  entrantB: {
    id: 'e2',
    displayName: 'Quetzales',
    displayTag: null,
    logoUrl: null,
    teamSlug: null,
    seed: null,
  },
  sourceA: null,
  sourceB: null,
  scoreA: 0,
  scoreB: 0,
  winnerId: null,
  resultSource: null,
  finalizedAt: null,
  version: 1,
  tournament: { id: 't1', slug: 'liga', name: 'Liga Apertura', timezone: 'America/Mexico_City' },
  myEntrantId: 'e1',
  ...over,
});

const delivery = (over: Partial<DeliveryRecord> = {}): DeliveryRecord => ({
  id: 'd1',
  notificationId: 'n1',
  sourceEventId: 'ev1',
  userId: 'user-ana',
  channel: 'discord',
  status: 'queued',
  subject: 'Inscripción aprobada',
  body: 'Ya estás dentro.',
  attempts: 0,
  lastError: null,
  sentAt: null,
  createdAt: NOW,
  link: '/app/torneos/liga',
  organizationId: 'org-1',
  typeKey: 'registration.approved',
  ...over,
});

describe('DiscordChannelAdapter', () => {
  const channel = (
    directory: InMemoryDiscordDirectory,
    discord: FakeDiscordAdapter,
    available = true,
  ) =>
    new DiscordChannelAdapter({
      directory,
      discord,
      theme,
      organization: { id: () => Promise.resolve('org-1') },
      available,
    });

  it('DMs the recipient a branded embed when approved', async () => {
    const { directory, discord } = makeDeps();
    directory.link('discord-ana', 'user-ana');
    const result = await channel(directory, discord).send(delivery());
    expect(result.providerMessageId).toBeTruthy();
    expect(discord.dms).toHaveLength(1);
    expect(discord.dms[0]?.discordUserId).toBe('discord-ana');
    expect(discord.dms[0]?.message.embed?.title).toBe('Inscripción aprobada');
    expect(discord.dms[0]?.message.link?.url).toBe('https://penta.gg/app/torneos/liga');
  });

  it('fails (non-retryable) when the recipient is not linked', async () => {
    const { directory, discord } = makeDeps();
    await expect(channel(directory, discord).send(delivery())).rejects.toMatchObject({
      code: 'discord_not_linked',
      retryable: false,
    });
  });

  it('posts staff notifications to the staff channel', async () => {
    const { directory, discord } = makeDeps();
    directory.guild = {
      guildId: '123',
      guildName: 'PENTA',
      features: {},
      verifiedRoleId: null,
      roleByTournament: {},
      channels: [{ purpose: 'staff', channelId: '999', tournamentId: null }],
    };
    await channel(directory, discord).send(
      delivery({ typeKey: 'staff.registration_submitted', userId: 'anyone' }),
    );
    expect(discord.channelMessages[0]?.channelId).toBe('999');
    expect(discord.dms).toHaveLength(0);
  });

  it('is unavailable without a bot token (engine skips Discord)', () => {
    const { directory, discord } = makeDeps();
    expect(channel(directory, discord, false).available).toBe(false);
  });
});

describe('bot commands', () => {
  let ctx: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    ctx = makeDeps({ matches: [match()] });
    ctx.directory.link('discord-ana', 'user-ana');
  });

  it('/proximo shows the next match with a link to the match center', async () => {
    const reply = await new BotNextMatchUseCase(ctx.deps).execute('discord-ana');
    expect(reply.embed?.title).toBe('Jaguares vs Quetzales');
    expect(reply.link?.url).toBe('https://penta.gg/app/partidas/m1');
  });

  it('/proximo asks unlinked users to link first', async () => {
    const reply = await new BotNextMatchUseCase(ctx.deps).execute('discord-stranger');
    expect(reply.ephemeral).toBe(true);
    expect(reply.content).toContain('no está vinculada');
  });

  it('/checkin registers the check-in of the open match', async () => {
    const open = match({ status: 'checkin', id: 'm9' });
    const local = makeDeps({ matches: [open] });
    local.directory.link('discord-ana', 'user-ana');
    const reply = await new BotCheckinUseCase(local.deps).execute('discord-ana');
    expect(local.checkedIn).toEqual(['m9']);
    expect(reply.content).toContain('Check-in registrado');
  });

  it('/checkin says so when no match is open', async () => {
    const reply = await new BotCheckinUseCase(ctx.deps).execute('discord-ana');
    expect(reply.content).toContain('check-in abierto');
    expect(ctx.checkedIn).toEqual([]);
  });

  it('/tabla returns the standings of a tournament by slug', async () => {
    const reply = await new BotStandingsUseCase(ctx.deps).execute('Liga');
    expect(reply.embed?.title).toBe('Tabla — Liga Apertura');
    expect(reply.embed?.description).toContain('Jaguares');
  });

  it('/tabla reports an unknown tournament', async () => {
    const reply = await new BotStandingsUseCase(ctx.deps).execute('inexistente');
    expect(reply.content).toContain('No encontré el torneo');
  });

  it('/perfil shows a linked player', async () => {
    const reply = await new BotPlayerUseCase(ctx.deps).execute('discord-ana');
    expect(reply.embed?.title).toBe('Ana');
    expect(reply.embed?.fields?.some((f) => f.value === 'Ana#LAN')).toBe(true);
  });

  it('/equipo shows a team, or reports it missing', async () => {
    const ok = await new BotTeamUseCase(ctx.deps).execute('Jaguares');
    expect(ok.embed?.title).toBe('Jaguares [JAG]');
    const missing = await new BotTeamUseCase(ctx.deps).execute('Fantasmas');
    expect(missing.content).toContain('No encontré el equipo');
  });

  it('/vincular confirms a linked account', async () => {
    const reply = await new BotLinkUseCase(ctx.deps).execute('discord-ana');
    expect(reply.content).toContain('ya está vinculada');
  });
});

describe('voice channels and roles', () => {
  function guilded(features: Record<string, boolean>) {
    const { deps, directory, discord } = makeDeps();
    directory.guild = {
      guildId: '123',
      guildName: 'PENTA',
      features,
      verifiedRoleId: 'role-verified',
      roleByTournament: {},
      channels: [{ purpose: 'match_voice_category', channelId: 'cat-1', tournamentId: null }],
    };
    return { deps, directory, discord };
  }

  it('creates one voice channel per entrant and records them', async () => {
    const { deps, directory, discord } = guilded({ voiceChannels: true });
    const created = await new CreateMatchVoiceUseCase(deps).execute('m1', [
      { entrantId: 'e1', name: 'Jaguares' },
      { entrantId: 'e2', name: 'Quetzales' },
    ]);
    expect(created).toBe(2);
    expect(discord.channels.map((c) => c.name)).toEqual(['Jaguares', 'Quetzales']);
    expect(directory.temp).toHaveLength(2);
  });

  it('does nothing when the voice feature is off', async () => {
    const { deps, discord } = guilded({ voiceChannels: false });
    expect(
      await new CreateMatchVoiceUseCase(deps).execute('m1', [{ entrantId: 'e1', name: 'A' }]),
    ).toBe(0);
    expect(discord.channels).toHaveLength(0);
  });

  it('deletes the temp channels of a match', async () => {
    const { deps, directory, discord } = guilded({ voiceChannels: true });
    await directory.recordTempChannel('g', 'm1', 'e1', 'chan-1');
    const closed = await new CloseMatchVoiceUseCase(deps).execute('m1');
    expect(closed).toBe(1);
    expect(discord.deletedChannels).toEqual(['chan-1']);
  });

  it('reconciles open and close from the directory work list', async () => {
    const { deps, directory, discord } = guilded({ voiceChannels: true });
    directory.voice = {
      toOpen: [{ matchId: 'm1', entrants: [{ entrantId: 'e1', name: 'Jaguares' }] }],
      toClose: [],
    };
    await directory.recordTempChannel('g', 'm2', null, 'old-chan');
    directory.voice = {
      toOpen: [{ matchId: 'm1', entrants: [{ entrantId: 'e1', name: 'Jaguares' }] }],
      toClose: ['m2'],
    };
    const result = await new ReconcileMatchVoiceUseCase(deps).execute();
    expect(result.opened).toBe(1);
    expect(result.closed).toBe(1);
    expect(discord.deletedChannels).toEqual(['old-chan']);
  });

  it('assigns the verified role when auto-roles are on and the user is linked', async () => {
    const { deps, directory, discord } = guilded({ autoRoles: true });
    directory.link('discord-ana', 'user-ana');
    expect(await new AssignVerifiedRoleUseCase(deps).execute('user-ana')).toBe(true);
    expect(discord.rolesAdded[0]).toMatchObject({
      roleId: 'role-verified',
      discordUserId: 'discord-ana',
    });
  });

  it('skips the role when auto-roles are off', async () => {
    const { deps } = guilded({ autoRoles: false });
    expect(await new AssignVerifiedRoleUseCase(deps).execute('user-ana')).toBe(false);
  });
});

describe('admin config', () => {
  it('reports a disconnected guild', async () => {
    const { deps } = makeDeps();
    const config = await new GetDiscordConfigUseCase(deps).execute();
    expect(config).toMatchObject({ connected: false, botReady: true, channels: [] });
  });

  it('reports the connected guild and its channels', async () => {
    const { deps, directory } = makeDeps();
    directory.guild = {
      guildId: '123',
      guildName: 'PENTA',
      features: { checkin: true },
      verifiedRoleId: 'r1',
      roleByTournament: {},
      channels: [{ purpose: 'staff', channelId: '999', tournamentId: null }],
    };
    const config = await new GetDiscordConfigUseCase(deps).execute();
    expect(config.connected).toBe(true);
    expect(config.channels).toEqual([{ purpose: 'staff', channelId: '999' }]);
    expect(config.features.checkin).toBe(true);
  });
});
