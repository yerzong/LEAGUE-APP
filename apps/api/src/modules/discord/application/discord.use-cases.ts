// Discord use cases (docs/specs/m07): the admin console config, the bot's
// slash-command replies (composed as ready Discord messages) and the match
// voice-channel lifecycle. All business reads reuse the existing query
// services; this layer only resolves the Discord identity and shapes replies.

import type {
  BotReply,
  DiscordConfig,
  SaveDiscordGuildRequest,
  SetDiscordChannelRequest,
} from '@league/contracts';
import {
  nextMatchEmbed,
  playerEmbed,
  standingsEmbed,
  teamEmbed,
  type DiscordMessage,
  type MatchEmbedInput,
} from '@league/integrations';

import { forbidden } from '../../../shared/application-error.js';
import type { DiscordDeps } from './deps.js';

const PLAYED = new Set(['completed', 'forfeit', 'canceled']);

function reply(message: DiscordMessage, ephemeral = false): BotReply {
  return { ...message, ephemeral } as BotReply;
}
function text(content: string, ephemeral = true): BotReply {
  return { content, ephemeral };
}

/** es-419 date in the tournament timezone. */
function formatWhen(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));
}

/** The slug we store tournaments and teams under (accents stripped). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Admin console
// ---------------------------------------------------------------------------
export class GetDiscordConfigUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(): Promise<DiscordConfig> {
    const organizationId = await this.deps.organization.id();
    const config = await this.deps.directory.guildConfig(organizationId);
    if (!config)
      return {
        guildId: null,
        guildName: null,
        connected: false,
        botReady: this.deps.botReady,
        features: {},
        channels: [],
        verifiedRoleId: null,
      };
    return {
      guildId: config.guildId,
      guildName: config.guildName,
      connected: true,
      botReady: this.deps.botReady,
      features: config.features,
      channels: config.channels
        .filter((c) => c.tournamentId === null)
        .map((c) => ({ purpose: c.purpose, channelId: c.channelId })),
      verifiedRoleId: config.verifiedRoleId,
    };
  }
}

export class SaveDiscordGuildUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(actorId: string, input: SaveDiscordGuildRequest): Promise<void> {
    const organizationId = await this.deps.organization.id();
    await this.deps.directory.saveGuild(organizationId, actorId, {
      guildId: input.guildId,
      guildName: input.guildName ?? null,
      settings: {
        features: input.features,
        roles: { verified: input.verifiedRoleId ?? null },
      },
    });
  }
}

export class SetDiscordChannelUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(actorId: string, input: SetDiscordChannelRequest): Promise<void> {
    const organizationId = await this.deps.organization.id();
    await this.deps.directory.setChannel(
      organizationId,
      actorId,
      input.purpose,
      input.channelId,
      null,
    );
  }
}

// ---------------------------------------------------------------------------
// Bot commands
// ---------------------------------------------------------------------------
abstract class BotUseCase {
  constructor(protected readonly deps: DiscordDeps) {}

  /** Resolves the platform user behind a Discord id, or a "link first" reply. */
  protected async requireUser(discordUserId: string): Promise<string | BotReply> {
    const userId = await this.deps.directory.userIdByDiscordId(discordUserId);
    if (userId) return userId;
    return {
      content:
        'Tu cuenta de Discord no está vinculada. Entra a la plataforma con Discord o usa /vincular.',
      link: { label: 'Vincular cuenta', url: `${this.deps.theme.webOrigin}/app/ajustes` },
      ephemeral: true,
    };
  }
}

export class BotNextMatchUseCase extends BotUseCase {
  async execute(discordUserId: string): Promise<BotReply> {
    const userId = await this.requireUser(discordUserId);
    if (typeof userId !== 'string') return userId;
    const matches = await this.deps.queries.myMatches.execute(userId);
    const upcoming = matches
      .filter((m) => !PLAYED.has(m.status))
      .sort(
        (a, b) =>
          (a.scheduledAt ? Date.parse(a.scheduledAt) : Number.MAX_SAFE_INTEGER) -
          (b.scheduledAt ? Date.parse(b.scheduledAt) : Number.MAX_SAFE_INTEGER),
      );
    const next = upcoming[0];
    return reply(nextMatchEmbed(this.deps.theme, next ? this.toMatchEmbed(next) : null));
  }

  private toMatchEmbed(m: {
    myEntrantId: string;
    entrantA: { id: string; displayName: string } | null;
    entrantB: { id: string; displayName: string } | null;
    tournament: { name: string; timezone: string };
    scheduledAt: string | null;
    phaseName: string;
    id: string;
  }): MatchEmbedInput {
    const mine = m.entrantA?.id === m.myEntrantId ? m.entrantA : m.entrantB;
    const other = m.entrantA?.id === m.myEntrantId ? m.entrantB : m.entrantA;
    return {
      tournamentName: m.tournament.name,
      entrantName: mine?.displayName ?? 'Tu equipo',
      opponentName: other?.displayName ?? null,
      when: formatWhen(m.scheduledAt, m.tournament.timezone),
      phaseName: m.phaseName,
      matchPath: `/app/partidas/${m.id}`,
    };
  }
}

export class BotCheckinUseCase extends BotUseCase {
  async execute(discordUserId: string): Promise<BotReply> {
    const userId = await this.requireUser(discordUserId);
    if (typeof userId !== 'string') return userId;
    const now = this.deps.clock.now().getTime();
    const matches = await this.deps.queries.myMatches.execute(userId);
    const open = matches.find(
      (m) =>
        m.status === 'checkin' ||
        (!PLAYED.has(m.status) &&
          m.checkinOpensAt !== null &&
          m.checkinClosesAt !== null &&
          Date.parse(m.checkinOpensAt) <= now &&
          now < Date.parse(m.checkinClosesAt)),
    );
    if (!open) return text('No tienes ninguna partida con check-in abierto en este momento.');
    try {
      await this.deps.queries.checkIn.execute(userId, open.id);
    } catch {
      return text('No se pudo registrar tu check-in. Intenta desde el centro de partida.');
    }
    return {
      content: '✅ Check-in registrado.',
      link: {
        label: 'Abrir centro de partida',
        url: `${this.deps.theme.webOrigin}/app/partidas/${open.id}`,
      },
      ephemeral: true,
    };
  }
}

export class BotStandingsUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(query: string): Promise<BotReply> {
    const tournament = await this.resolve(query);
    if (!tournament) return text(`No encontré el torneo "${query}".`);
    const board = await this.deps.queries.board.execute(tournament.slug);
    const group = board.phases.flatMap((p) => p.groups).find((g) => g.standings.length > 0);
    const rows = (group?.standings ?? []).map((s) => ({
      rank: s.rank,
      name: s.entrant.displayName,
      wins: s.wins,
      losses: s.losses,
      points: s.points,
    }));
    return reply(
      standingsEmbed(this.deps.theme, {
        tournamentName: tournament.name,
        slug: tournament.slug,
        rows,
      }),
    );
  }

  /** By slug (the user may type the name; it is slugified the same way we store it). */
  private async resolve(query: string): Promise<{ slug: string; name: string } | null> {
    const slug = slugify(query);
    const bySlug =
      (await this.deps.tournaments.findBySlug(slug)) ??
      (await this.deps.tournaments.findBySlug(query.trim().toLowerCase()));
    return bySlug ? { slug: bySlug.slug, name: bySlug.config.basics.name } : null;
  }
}

export class BotPlayerUseCase extends BotUseCase {
  async execute(discordUserId: string, targetDiscordUserId?: string): Promise<BotReply> {
    const lookupId = targetDiscordUserId ?? discordUserId;
    const userId = await this.deps.directory.userIdByDiscordId(lookupId);
    if (!userId)
      return text(
        targetDiscordUserId
          ? 'Ese usuario de Discord no tiene una cuenta vinculada.'
          : 'Tu cuenta de Discord no está vinculada. Usa /vincular.',
      );
    const profile = await this.deps.profiles.findById(userId);
    if (!profile?.username) return text('Ese jugador no tiene un perfil público.');
    const player = await this.deps.queries.player.execute(profile.username, null);
    return reply(
      playerEmbed(this.deps.theme, {
        username: player.username,
        displayName: player.displayName,
        roles: [player.primaryRole, player.secondaryRole].filter(
          (r): r is NonNullable<typeof r> => r !== null,
        ),
        riotId: player.riotAccount
          ? `${player.riotAccount.gameName}#${player.riotAccount.tagLine}`
          : null,
        radar: null,
        record: null,
        topChampions: [],
      }),
    );
  }
}

export class BotTeamUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(name: string): Promise<BotReply> {
    const slug = slugify(name);
    let team;
    try {
      team = await this.deps.queries.team.execute(slug, null);
    } catch {
      return text(`No encontré el equipo "${name}".`);
    }
    return reply(
      teamEmbed(this.deps.theme, {
        name: team.name,
        tag: team.tag,
        slug: team.slug,
        region: team.region,
        record: null,
        roster: team.members
          .filter((m) => m.username !== null)
          .map((m) => `${m.displayName ?? (m.username as string)} (${m.teamRole})`),
      }),
    );
  }
}

export class BotLinkUseCase extends BotUseCase {
  async execute(discordUserId: string): Promise<BotReply> {
    const userId = await this.deps.directory.userIdByDiscordId(discordUserId);
    if (userId) return text('Tu cuenta de Discord ya está vinculada. ✅');
    return {
      content:
        'Para vincular tu cuenta, entra a la plataforma con Discord (o conéctalo en Ajustes si entraste por correo).',
      link: {
        label: 'Ir a Ajustes',
        url: `${this.deps.theme.webOrigin}/app/ajustes`,
      },
      ephemeral: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Match voice channels — opened when check-in starts, deleted when it ends.
// A reconciler (DiscordWorker) drives these off match status, like the
// check-in sweeper; they can also be called directly for a single match.
// ---------------------------------------------------------------------------
export class CreateMatchVoiceUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  /** Creates one voice channel per entrant under the category and records them. */
  async execute(
    matchId: string,
    entrants: readonly { readonly entrantId: string; readonly name: string }[],
  ): Promise<number> {
    const organizationId = await this.deps.organization.id();
    const config = await this.deps.directory.guildConfig(organizationId);
    if (!config || config.features.voiceChannels !== true) return 0;
    const categoryId = await this.deps.directory.channelIdFor(
      organizationId,
      'match_voice_category',
      null,
    );
    const guildRowId = await this.deps.directory.guildRowId(organizationId);
    if (!categoryId || !guildRowId) return 0;
    let created = 0;
    for (const entrant of entrants) {
      const { channelId } = await this.deps.discord.createVoiceChannel(
        config.guildId,
        entrant.name,
        { parentId: categoryId, userLimit: 6 },
      );
      await this.deps.directory.recordTempChannel(
        guildRowId,
        matchId,
        entrant.entrantId,
        channelId,
      );
      created += 1;
    }
    return created;
  }
}

export class CloseMatchVoiceUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(matchId: string): Promise<number> {
    const channelIds = await this.deps.directory.closeTempChannels(matchId);
    for (const channelId of channelIds) {
      try {
        await this.deps.discord.deleteChannel(channelId);
      } catch {
        // Already gone on Discord's side: the bookkeeping is closed regardless.
      }
    }
    return channelIds.length;
  }
}

/** Opens voice channels for matches now in check-in, closes them when the match ends. */
export class ReconcileMatchVoiceUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  async execute(): Promise<{ opened: number; closed: number }> {
    const organizationId = await this.deps.organization.id();
    const config = await this.deps.directory.guildConfig(organizationId);
    if (!this.deps.botReady || !config || config.features.voiceChannels !== true)
      return { opened: 0, closed: 0 };
    const { toOpen, toClose } = await this.deps.directory.voiceWork(organizationId);
    const create = new CreateMatchVoiceUseCase(this.deps);
    const close = new CloseMatchVoiceUseCase(this.deps);
    let opened = 0;
    for (const match of toOpen) opened += await create.execute(match.matchId, match.entrants);
    let closed = 0;
    for (const matchId of toClose) closed += await close.execute(matchId);
    return { opened, closed };
  }
}

export class AssignVerifiedRoleUseCase {
  constructor(private readonly deps: DiscordDeps) {}

  /** Gives the "verified player" role once a user links Riot (no-op without config). */
  async execute(userId: string): Promise<boolean> {
    const organizationId = await this.deps.organization.id();
    const config = await this.deps.directory.guildConfig(organizationId);
    if (!config || config.features.autoRoles !== true || !config.verifiedRoleId) return false;
    const discordId = await this.deps.directory.discordIdOf(userId);
    if (!discordId) return false;
    await this.deps.discord.addRole(config.guildId, discordId, config.verifiedRoleId);
    return true;
  }
}

/** Only staff may read or change the Discord config. */
export async function requireStaff(deps: DiscordDeps, userId: string): Promise<void> {
  const profile = await deps.profiles.findById(userId);
  if (profile?.platformRole !== 'super_admin') throw forbidden('staff_only');
}
