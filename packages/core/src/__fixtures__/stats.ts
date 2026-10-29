// A 30-minute game Blue wins: Blue 20 kills / 40 000 damage, Red 10 / 30 000.
import type { GameInput, GameRole, ParticipantInput, TeamInput } from '../stats/game-stats.js';

const ROLES: readonly GameRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];

type Line = Pick<
  ParticipantInput,
  'kills' | 'deaths' | 'assists' | 'cs' | 'damageToChampions' | 'visionScore'
>;

const BLUE: Record<GameRole, Line> = {
  top: { kills: 4, deaths: 2, assists: 5, cs: 240, damageToChampions: 9_000, visionScore: 20 },
  jungle: { kills: 3, deaths: 3, assists: 9, cs: 180, damageToChampions: 6_000, visionScore: 40 },
  mid: { kills: 8, deaths: 2, assists: 6, cs: 270, damageToChampions: 12_000, visionScore: 30 },
  adc: { kills: 5, deaths: 1, assists: 7, cs: 300, damageToChampions: 10_000, visionScore: 15 },
  support: { kills: 0, deaths: 3, assists: 15, cs: 30, damageToChampions: 3_000, visionScore: 90 },
};
const RED: Record<GameRole, Line> = {
  top: { kills: 2, deaths: 4, assists: 3, cs: 220, damageToChampions: 7_000, visionScore: 18 },
  jungle: { kills: 2, deaths: 5, assists: 4, cs: 150, damageToChampions: 5_000, visionScore: 35 },
  mid: { kills: 3, deaths: 4, assists: 3, cs: 250, damageToChampions: 9_000, visionScore: 25 },
  adc: { kills: 3, deaths: 3, assists: 2, cs: 280, damageToChampions: 7_000, visionScore: 12 },
  support: { kills: 0, deaths: 4, assists: 7, cs: 25, damageToChampions: 2_000, visionScore: 70 },
};

const sideOf = (puuid: string) => (puuid.startsWith('blue') ? 'blue' : 'red');
const roleOf = (puuid: string): GameRole => ROLES.find((r) => puuid.endsWith(`-${r}`)) ?? 'mid';

/** A player of the fixture game (stats by side and role), with overrides. */
export function participant(
  puuid: string,
  overrides: Partial<ParticipantInput> = {},
): ParticipantInput {
  const side = sideOf(puuid);
  const role = roleOf(puuid);
  return {
    puuid,
    userId: `user-${puuid}`,
    entrantId: side,
    side,
    championId: (side === 'blue' ? 100 : 200) + ROLES.indexOf(role),
    role,
    ...(side === 'blue' ? BLUE : RED)[role],
    gold: 13_500,
    damageTaken: 15_000,
    wardsPlaced: 10,
    wardsKilled: 2,
    firstBloodKill: puuid === 'blue-mid',
    doubleKills: 0,
    tripleKills: 0,
    quadraKills: 0,
    pentaKills: 0,
    turretKills: 1,
    dragonKills: 0,
    baronKills: 0,
    items: [3031, 3006],
    runes: { keystone: 8005, primaryStyle: 8000, secondaryStyle: 8100 },
    ...overrides,
  };
}

function team(side: 'blue' | 'red'): TeamInput {
  const blue = side === 'blue';
  return {
    side,
    entrantId: side,
    win: blue,
    bans: blue ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10],
    towers: blue ? 9 : 3,
    dragons: blue ? 3 : 1,
    barons: blue ? 1 : 0,
    heralds: blue ? 1 : 0,
    grubs: blue ? 4 : 2,
    inhibitors: blue ? 2 : 0,
    firstTower: blue,
    firstDragon: blue,
    firstBaron: blue,
  };
}

/** The fixture game; `blue`/`red` replace players by puuid. */
export function game(
  replace: { blue?: readonly ParticipantInput[]; red?: readonly ParticipantInput[] } = {},
): GameInput {
  const players = (side: 'blue' | 'red') =>
    ROLES.map((r) => {
      const puuid = `${side}-${r}`;
      return replace[side]?.find((p) => p.puuid === puuid) ?? participant(puuid);
    });
  return {
    durationSeconds: 1_800,
    teams: [team('blue'), team('red')],
    participants: [...players('blue'), ...players('red')],
  };
}
