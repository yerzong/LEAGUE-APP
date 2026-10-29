// Aggregates over many games (docs/03 §8, docs/08 §5): a player's numbers in
// a scope with the radar, champions, team numbers, the champion meta of a
// tournament, weekly evolution, recent form and head-to-head.

import type { ChampionId } from '../types.js';
import { kdaOf, type PlayerGameLine, type TeamGameLine } from './game-stats.js';

/** A player's line in one game, with when and which game it was. */
export interface HistoryLine extends PlayerGameLine {
  readonly gameId: string;
  /** ISO timestamp the game ended. */
  readonly playedAt: string;
}

export const RADAR_AXES = ['aggression', 'vision', 'farming', 'teamfight', 'survival'] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];
export type Radar = Readonly<Record<RadarAxis, number>>;

/**
 * Fixed reference ranges (amateur LATAM, any role): the low end maps to 0 and
 * the high end to 100. Fixed, not relative to other players, so a radar only
 * changes when the player's own numbers change.
 */
export const RADAR_RANGES = {
  damagePerMin: [150, 800],
  killsPer10: [0, 3],
  visionPerMin: [0.3, 2.5],
  csPerMin: [2, 10],
  killParticipation: [0.3, 0.8],
  damageShare: [0.1, 0.35],
  deathsPer10: [0.5, 3],
} as const satisfies Record<string, readonly [number, number]>;

export interface RadarInput {
  readonly minutes: number;
  readonly kills: number;
  readonly assists: number;
  readonly deaths: number;
  readonly damagePerMin: number;
  readonly visionPerMin: number;
  readonly csPerMin: number;
  readonly killParticipation: number;
  readonly damageShare: number;
}

const round = (value: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
const mean = (values: readonly number[]) =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
const scale = (value: number, [low, high]: readonly [number, number]) =>
  Math.min(1, Math.max(0, (value - low) / (high - low)));
const toAxis = (fraction: number) => Math.round(fraction * 100);

/** The radar of a set of games: each axis 0–100, integer. */
export function computeRadar(input: RadarInput): Radar {
  const per10 = (n: number) => (input.minutes > 0 ? (n / input.minutes) * 10 : 0);
  const r = RADAR_RANGES;
  return {
    aggression: toAxis(
      (scale(input.damagePerMin, r.damagePerMin) + scale(per10(input.kills), r.killsPer10)) / 2,
    ),
    vision: toAxis(scale(input.visionPerMin, r.visionPerMin)),
    farming: toAxis(scale(input.csPerMin, r.csPerMin)),
    teamfight: toAxis(
      0.6 * scale(input.killParticipation, r.killParticipation) +
        0.4 * scale(input.damageShare, r.damageShare),
    ),
    survival: toAxis(1 - scale(per10(input.deaths), r.deathsPer10)),
  };
}

export interface PlayerAggregate {
  readonly games: number;
  readonly wins: number;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly kda: number;
  readonly avgCsPerMin: number;
  readonly avgGoldPerMin: number;
  readonly avgDamagePerMin: number;
  readonly avgVisionPerMin: number;
  readonly avgKillParticipation: number;
  readonly avgDamageShare: number;
  readonly avgScore: number;
  readonly mvps: number;
  readonly radar: Radar;
}

/** Totals, time-weighted rates and the radar; `null` without games. */
export function aggregatePlayer(lines: readonly PlayerGameLine[]): PlayerAggregate | null {
  if (lines.length === 0) return null;
  const total = (pick: (l: PlayerGameLine) => number) => lines.reduce((s, l) => s + pick(l), 0);
  const minutes = total((l) => l.durationSeconds) / 60;
  const perMin = (pick: (l: PlayerGameLine) => number) => round(total(pick) / minutes);
  const kills = total((l) => l.kills);
  const deaths = total((l) => l.deaths);
  const assists = total((l) => l.assists);
  const rates = {
    avgCsPerMin: perMin((l) => l.cs),
    avgGoldPerMin: perMin((l) => l.gold),
    avgDamagePerMin: perMin((l) => l.damageToChampions),
    avgVisionPerMin: perMin((l) => l.visionScore),
    avgKillParticipation: round(mean(lines.map((l) => l.killParticipation)), 4),
    avgDamageShare: round(mean(lines.map((l) => l.damageShare)), 4),
  };
  return {
    games: lines.length,
    wins: lines.filter((l) => l.win).length,
    kills,
    deaths,
    assists,
    kda: kdaOf(kills, deaths, assists),
    ...rates,
    avgScore: round(mean(lines.map((l) => l.score))),
    mvps: lines.filter((l) => l.isMvp).length,
    radar: computeRadar({
      minutes,
      kills,
      assists,
      deaths,
      damagePerMin: rates.avgDamagePerMin,
      visionPerMin: rates.avgVisionPerMin,
      csPerMin: rates.avgCsPerMin,
      killParticipation: rates.avgKillParticipation,
      damageShare: rates.avgDamageShare,
    }),
  };
}

export interface ChampionLine {
  readonly championId: ChampionId;
  readonly games: number;
  readonly wins: number;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly kda: number;
}

/** Per champion; most played first, then most wins, then champion id. */
export function championStats(lines: readonly PlayerGameLine[]): ChampionLine[] {
  const by = new Map<ChampionId, PlayerGameLine[]>();
  for (const l of lines) by.set(l.championId, [...(by.get(l.championId) ?? []), l]);
  return [...by]
    .map(([championId, ls]) => {
      const kills = ls.reduce((s, l) => s + l.kills, 0);
      const deaths = ls.reduce((s, l) => s + l.deaths, 0);
      const assists = ls.reduce((s, l) => s + l.assists, 0);
      return {
        championId,
        games: ls.length,
        wins: ls.filter((l) => l.win).length,
        kills,
        deaths,
        assists,
        kda: kdaOf(kills, deaths, assists),
      };
    })
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.championId - b.championId);
}

export interface TeamAggregate {
  readonly games: number;
  readonly wins: number;
  readonly avgDurationSeconds: number;
  readonly avgKills: number;
  readonly avgTowers: number;
  readonly avgDragons: number;
  readonly avgBarons: number;
  readonly firstBloodRate: number;
  readonly firstTowerRate: number;
}

export function aggregateTeam(lines: readonly TeamGameLine[]): TeamAggregate | null {
  if (lines.length === 0) return null;
  const avg = (pick: (l: TeamGameLine) => number) => round(mean(lines.map(pick)));
  const rate = (pick: (l: TeamGameLine) => boolean) =>
    round(lines.filter(pick).length / lines.length, 4);
  return {
    games: lines.length,
    wins: lines.filter((l) => l.win).length,
    avgDurationSeconds: Math.round(mean(lines.map((l) => l.durationSeconds))),
    avgKills: avg((l) => l.kills),
    avgTowers: avg((l) => l.towers),
    avgDragons: avg((l) => l.dragons),
    avgBarons: avg((l) => l.barons),
    firstBloodRate: rate((l) => l.firstBlood),
    firstTowerRate: rate((l) => l.firstTower),
  };
}

export interface ChampionMetaLine {
  readonly championId: ChampionId;
  readonly picks: number;
  readonly bans: number;
  readonly wins: number;
}

/** Picks, bans and wins per champion; highest presence (picks + bans) first. */
export function championMeta(input: {
  readonly picks: readonly { readonly championId: ChampionId; readonly win: boolean }[];
  readonly bans: readonly ChampionId[];
}): ChampionMetaLine[] {
  const by = new Map<ChampionId, { picks: number; bans: number; wins: number }>();
  const entry = (id: ChampionId) => {
    let e = by.get(id);
    if (!e) {
      e = { picks: 0, bans: 0, wins: 0 };
      by.set(id, e);
    }
    return e;
  };
  for (const p of input.picks) {
    const e = entry(p.championId);
    e.picks += 1;
    if (p.win) e.wins += 1;
  }
  for (const id of input.bans) entry(id).bans += 1;
  return [...by]
    .map(([championId, e]) => ({ championId, ...e }))
    .sort(
      (a, b) =>
        b.picks + b.bans - (a.picks + a.bans) || b.picks - a.picks || a.championId - b.championId,
    );
}

export interface WeekPoint {
  /** Monday of the week (UTC), YYYY-MM-DD. */
  readonly weekStart: string;
  readonly games: number;
  readonly wins: number;
  readonly kda: number;
  readonly avgScore: number;
}

function mondayOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/** Weekly progression, oldest week first. */
export function weeklyEvolution(lines: readonly HistoryLine[]): WeekPoint[] {
  const by = new Map<string, HistoryLine[]>();
  for (const l of lines) {
    const week = mondayOf(l.playedAt);
    by.set(week, [...(by.get(week) ?? []), l]);
  }
  return [...by]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, ls]) => ({
      weekStart,
      games: ls.length,
      wins: ls.filter((l) => l.win).length,
      kda: kdaOf(
        ls.reduce((s, l) => s + l.kills, 0),
        ls.reduce((s, l) => s + l.deaths, 0),
        ls.reduce((s, l) => s + l.assists, 0),
      ),
      avgScore: round(mean(ls.map((l) => l.score))),
    }));
}

export type FormResult = 'win' | 'loss';

/** The last `count` results, newest first. */
export function recentForm(
  results: readonly { readonly win: boolean; readonly playedAt: string }[],
  count = 5,
): FormResult[] {
  return [...results]
    .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
    .slice(0, count)
    .map((r) => (r.win ? 'win' : 'loss'));
}

export interface HeadToHead {
  readonly games: number;
  readonly winsA: number;
  readonly winsB: number;
  readonly a: PlayerAggregate | null;
  readonly b: PlayerAggregate | null;
}

/** Two players over the games they played on opposite sides. */
export function headToHead(a: readonly HistoryLine[], b: readonly HistoryLine[]): HeadToHead {
  const bByGame = new Map(b.map((l) => [l.gameId, l]));
  const pairs = a.flatMap((la) => {
    const lb = bByGame.get(la.gameId);
    return lb && lb.side !== la.side ? [[la, lb] as const] : [];
  });
  return {
    games: pairs.length,
    winsA: pairs.filter(([la]) => la.win).length,
    winsB: pairs.filter(([, lb]) => lb.win).length,
    a: aggregatePlayer(pairs.map(([la]) => la)),
    b: aggregatePlayer(pairs.map(([, lb]) => lb)),
  };
}
