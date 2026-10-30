// Pure embed builders (docs/specs/m07 §5): the bot's replies and the
// notification channel share these. Brand color comes in as a decimal (no
// hardcoded hex); the default is a neutral silver matching the design tokens.

import type { DiscordEmbed, DiscordMessage } from './ports.js';

/** Design-token "silver" as a Discord decimal color (docs/08 §3). */
export const DEFAULT_BRAND_COLOR = 0xc8cdd6;

export interface EmbedTheme {
  readonly color: number;
  /** Absolute base URL of the site, for links (no trailing slash). */
  readonly webOrigin: string;
}

const trim = (origin: string) => origin.replace(/\/$/, '');
const link = (theme: EmbedTheme, path: string) => `${trim(theme.webOrigin)}${path}`;

export interface MatchEmbedInput {
  readonly tournamentName: string;
  readonly entrantName: string;
  readonly opponentName: string | null;
  /** Already formatted in the tournament timezone (es-419). */
  readonly when: string | null;
  readonly phaseName: string | null;
  readonly matchPath: string;
}

export function nextMatchEmbed(theme: EmbedTheme, m: MatchEmbedInput | null): DiscordMessage {
  if (!m)
    return {
      embed: {
        title: 'Sin partidas próximas',
        description: 'No tienes ninguna partida programada por ahora.',
        color: theme.color,
      },
    };
  const url = link(theme, m.matchPath);
  return {
    embed: {
      title: `${m.entrantName} vs ${m.opponentName ?? 'por definir'}`,
      description: m.tournamentName,
      color: theme.color,
      url,
      fields: [
        ...(m.when ? [{ name: 'Cuándo', value: m.when, inline: true }] : []),
        ...(m.phaseName ? [{ name: 'Fase', value: m.phaseName, inline: true }] : []),
      ],
    },
    link: { label: 'Abrir centro de partida', url },
  };
}

export interface StandingRow {
  readonly rank: number;
  readonly name: string;
  readonly wins: number;
  readonly losses: number;
  readonly points: number;
}

export function standingsEmbed(
  theme: EmbedTheme,
  input: {
    readonly tournamentName: string;
    readonly slug: string;
    readonly rows: readonly StandingRow[];
  },
): DiscordMessage {
  const url = link(theme, `/torneos/${input.slug}`);
  const body =
    input.rows.length === 0
      ? 'Todavía no hay posiciones.'
      : input.rows
          .slice(0, 10)
          .map(
            (r) =>
              `\`${String(r.rank).padStart(2, ' ')}\` **${r.name}** · ${String(r.wins)}-${String(r.losses)} · ${String(r.points)} pts`,
          )
          .join('\n');
  return {
    embed: { title: `Tabla — ${input.tournamentName}`, description: body, color: theme.color, url },
    link: { label: 'Ver torneo', url },
  };
}

export interface PlayerEmbedInput {
  readonly username: string;
  readonly displayName: string | null;
  readonly roles: readonly string[];
  readonly riotId: string | null;
  readonly radar: Readonly<Record<string, number>> | null;
  readonly record: { readonly wins: number; readonly losses: number } | null;
  readonly topChampions: readonly string[];
}

export function playerEmbed(theme: EmbedTheme, p: PlayerEmbedInput): DiscordMessage {
  const url = link(theme, `/jugadores/${p.username}`);
  const fields: NonNullable<DiscordEmbed['fields']>[number][] = [];
  if (p.riotId) fields.push({ name: 'Riot ID', value: p.riotId, inline: true });
  if (p.roles.length > 0) fields.push({ name: 'Roles', value: p.roles.join(', '), inline: true });
  if (p.record)
    fields.push({
      name: 'Récord',
      value: `${String(p.record.wins)}V - ${String(p.record.losses)}D`,
      inline: true,
    });
  if (p.radar)
    fields.push({
      name: 'Radar',
      value: Object.entries(p.radar)
        .map(([axis, value]) => `${axis}: ${String(value)}`)
        .join(' · '),
    });
  if (p.topChampions.length > 0)
    fields.push({ name: 'Campeones', value: p.topChampions.join(', ') });
  return {
    embed: {
      title: p.displayName ?? p.username,
      description: `@${p.username}`,
      color: theme.color,
      url,
      fields,
    },
    link: { label: 'Ver perfil', url },
  };
}

export interface TeamEmbedInput {
  readonly name: string;
  readonly tag: string;
  readonly slug: string;
  readonly region: string;
  readonly record: { readonly wins: number; readonly losses: number } | null;
  readonly roster: readonly string[];
}

export function teamEmbed(theme: EmbedTheme, t: TeamEmbedInput): DiscordMessage {
  const url = link(theme, `/equipos/${t.slug}`);
  const fields: NonNullable<DiscordEmbed['fields']>[number][] = [
    { name: 'Región', value: t.region, inline: true },
  ];
  if (t.record)
    fields.push({
      name: 'Récord',
      value: `${String(t.record.wins)}V - ${String(t.record.losses)}D`,
      inline: true,
    });
  if (t.roster.length > 0) fields.push({ name: 'Roster', value: t.roster.join('\n') });
  return {
    embed: { title: `${t.name} [${t.tag}]`, color: theme.color, url, fields },
    link: { label: 'Ver equipo', url },
  };
}

/** A notification rendered for Discord (DM or channel), from the m06 engine. */
export function notificationMessage(
  theme: EmbedTheme,
  n: { readonly subject: string; readonly body: string; readonly path: string | null },
): DiscordMessage {
  const url = n.path ? link(theme, n.path) : null;
  return {
    embed: {
      title: n.subject,
      description: n.body,
      color: theme.color,
      ...(url ? { url } : {}),
    },
    ...(url ? { link: { label: 'Abrir en la plataforma', url } } : {}),
  };
}
