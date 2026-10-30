// Per-game stats (docs/03 §8, docs/specs/m09 §2): from one normalized game
// (Match-V5 or manual data), the line of each player and each team, the
// notable moments and the game MVP.

import { InvalidGameStatsError } from '../errors.js';
import type { ChampionId, EntrantId, Side } from '../types.js';

export type GameRole = 'top' | 'jungle' | 'mid' | 'adc' | 'support';

export interface ParticipantInput {
  readonly puuid: string;
  /** `null` when the account is not linked to a platform user. */
  readonly userId: string | null;
  readonly entrantId: EntrantId;
  readonly side: Side;
  readonly championId: ChampionId;
  readonly role: GameRole | null;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  /** Minions plus neutral monsters. */
  readonly cs: number;
  readonly gold: number;
  readonly damageToChampions: number;
  readonly damageTaken: number;
  readonly visionScore: number;
  readonly wardsPlaced: number;
  readonly wardsKilled: number;
  readonly firstBloodKill: boolean;
  readonly doubleKills: number;
  readonly tripleKills: number;
  readonly quadraKills: number;
  readonly pentaKills: number;
  readonly turretKills: number;
  readonly dragonKills: number;
  readonly baronKills: number;
  readonly items: readonly number[];
  readonly runes: {
    readonly keystone: number | null;
    readonly primaryStyle: number | null;
    readonly secondaryStyle: number | null;
  };
}

export interface TeamInput {
  readonly side: Side;
  readonly entrantId: EntrantId;
  readonly win: boolean;
  readonly bans: readonly ChampionId[];
  readonly towers: number;
  readonly dragons: number;
  readonly barons: number;
  readonly heralds: number;
  readonly grubs: number;
  readonly inhibitors: number;
  readonly firstTower: boolean;
  readonly firstDragon: boolean;
  readonly firstBaron: boolean;
}

export interface GameInput {
  readonly durationSeconds: number;
  readonly teams: readonly TeamInput[];
  readonly participants: readonly ParticipantInput[];
}

export interface PlayerGameLine extends ParticipantInput {
  readonly win: boolean;
  readonly durationSeconds: number;
  readonly kda: number;
  readonly csPerMin: number;
  readonly goldPerMin: number;
  readonly damagePerMin: number;
  readonly visionPerMin: number;
  /** Of the team's damage to champions, 0–1. */
  readonly damageShare: number;
  /** Kills plus assists over the team's kills, 0–1. */
  readonly killParticipation: number;
  readonly score: number;
  readonly isMvp: boolean;
}

export interface TeamGameLine {
  readonly entrantId: EntrantId;
  readonly side: Side;
  readonly win: boolean;
  readonly durationSeconds: number;
  readonly kills: number;
  readonly gold: number;
  readonly towers: number;
  readonly dragons: number;
  readonly barons: number;
  readonly heralds: number;
  readonly grubs: number;
  readonly inhibitors: number;
  readonly firstBlood: boolean;
  readonly firstTower: boolean;
  readonly firstDragon: boolean;
  readonly firstBaron: boolean;
  readonly bans: readonly ChampionId[];
}

export type NotableEventType =
  'first_blood' | 'first_tower' | 'first_dragon' | 'first_baron' | 'quadrakill' | 'pentakill';

export interface NotableEvent {
  readonly type: NotableEventType;
  /** The player, or `null` for a team objective. */
  readonly actorPuuid: string | null;
  readonly side: Side;
}

export interface GameStats {
  readonly players: readonly PlayerGameLine[];
  readonly teams: readonly TeamGameLine[];
  readonly events: readonly NotableEvent[];
  readonly mvpPuuid: string | null;
}

const round = (value: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/** K+A over deaths (deaths floored at one, as the scoreboards show it). */
export const kdaOf = (kills: number, deaths: number, assists: number): number =>
  round((kills + assists) / Math.max(1, deaths));

/**
 * Performance score of one game, the MVP criterion: kills, assists, damage,
 * vision, farm and objectives add; deaths subtract; the win adds 5.
 */
export function performanceScore(
  line: Pick<
    PlayerGameLine,
    | 'kills'
    | 'deaths'
    | 'assists'
    | 'damagePerMin'
    | 'visionPerMin'
    | 'csPerMin'
    | 'turretKills'
    | 'dragonKills'
    | 'baronKills'
    | 'win'
  >,
): number {
  return round(
    line.kills * 3 +
      line.assists * 2 -
      line.deaths * 2 +
      line.damagePerMin / 100 +
      line.visionPerMin * 2 +
      line.csPerMin +
      line.turretKills +
      line.dragonKills * 2 +
      line.baronKills * 3 +
      (line.win ? 5 : 0),
  );
}

function validate(game: GameInput): void {
  if (!(game.durationSeconds > 0))
    throw new InvalidGameStatsError('game duration must be positive', { reason: 'duration' });
  const sides = new Set(game.teams.map((t) => t.side));
  if (game.teams.length !== 2 || sides.size !== 2)
    throw new InvalidGameStatsError('a game has a blue and a red team', { reason: 'teams' });
  if (game.teams.filter((t) => t.win).length !== 1)
    throw new InvalidGameStatsError('exactly one team wins', { reason: 'winner' });
  if (game.participants.some((p) => !sides.has(p.side)))
    throw new InvalidGameStatsError('participant without team', { reason: 'participants' });
}

/** Stats of one game. Pure: the same game always gives the same lines. */
export function deriveGameStats(game: GameInput): GameStats {
  validate(game);
  const minutes = game.durationSeconds / 60;
  const teamOf = (side: Side) => game.teams.find((t) => t.side === side) as TeamInput;
  const onSide = (side: Side) => game.participants.filter((p) => p.side === side);
  const sum = (side: Side, pick: (p: ParticipantInput) => number) =>
    onSide(side).reduce((total, p) => total + pick(p), 0);

  const lines = game.participants.map((p) => {
    const win = teamOf(p.side).win;
    const base = {
      ...p,
      win,
      durationSeconds: game.durationSeconds,
      kda: kdaOf(p.kills, p.deaths, p.assists),
      csPerMin: round(p.cs / minutes),
      goldPerMin: round(p.gold / minutes),
      damagePerMin: round(p.damageToChampions / minutes),
      visionPerMin: round(p.visionScore / minutes),
      damageShare: round(
        ratio(
          p.damageToChampions,
          sum(p.side, (q) => q.damageToChampions),
        ),
        4,
      ),
      killParticipation: round(
        ratio(
          p.kills + p.assists,
          sum(p.side, (q) => q.kills),
        ),
        4,
      ),
    };
    return { ...base, score: performanceScore(base), isMvp: false };
  });

  // Best score of the winning side; ties go to the earlier participant.
  const mvp = lines
    .filter((l) => l.win)
    .reduce<(typeof lines)[number] | null>(
      (best, l) => (!best || l.score > best.score ? l : best),
      null,
    );
  const players = lines.map((l) => (l === mvp ? { ...l, isMvp: true } : l));

  const teams = game.teams.map((t): TeamGameLine => ({
    entrantId: t.entrantId,
    side: t.side,
    win: t.win,
    durationSeconds: game.durationSeconds,
    kills: sum(t.side, (p) => p.kills),
    gold: sum(t.side, (p) => p.gold),
    towers: t.towers,
    dragons: t.dragons,
    barons: t.barons,
    heralds: t.heralds,
    grubs: t.grubs,
    inhibitors: t.inhibitors,
    firstBlood: onSide(t.side).some((p) => p.firstBloodKill),
    firstTower: t.firstTower,
    firstDragon: t.firstDragon,
    firstBaron: t.firstBaron,
    bans: [...t.bans],
  }));

  const events: NotableEvent[] = [];
  const firstBlood = game.participants.find((p) => p.firstBloodKill);
  if (firstBlood)
    events.push({ type: 'first_blood', actorPuuid: firstBlood.puuid, side: firstBlood.side });
  for (const [type, flag] of [
    ['first_tower', 'firstTower'],
    ['first_dragon', 'firstDragon'],
    ['first_baron', 'firstBaron'],
  ] as const) {
    const t = game.teams.find((x) => x[flag]);
    if (t) events.push({ type, actorPuuid: null, side: t.side });
  }
  for (const p of game.participants) {
    if (p.quadraKills > 0) events.push({ type: 'quadrakill', actorPuuid: p.puuid, side: p.side });
    if (p.pentaKills > 0) events.push({ type: 'pentakill', actorPuuid: p.puuid, side: p.side });
  }

  return { players, teams, events, mvpPuuid: mvp?.puuid ?? null };
}
