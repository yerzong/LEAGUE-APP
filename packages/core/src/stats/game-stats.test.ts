import { describe, expect, it } from 'vitest';

import { InvalidGameStatsError } from '../errors.js';
import { deriveGameStats, performanceScore } from './game-stats.js';
import { game, participant } from '../__fixtures__/stats.js';

describe('deriveGameStats', () => {
  it('derives each player line: KDA, per-minute rates, shares and participation', () => {
    const { players } = deriveGameStats(game());
    const mid = players.find((p) => p.puuid === 'blue-mid');
    // 30-minute game; blue team: 20 kills, 40 000 damage.
    expect(mid).toMatchObject({
      entrantId: 'blue',
      win: true,
      kills: 8,
      deaths: 2,
      assists: 6,
      kda: 7,
      cs: 270,
      csPerMin: 9,
      goldPerMin: 450,
      damageShare: 0.3,
      killParticipation: 0.7,
      damagePerMin: 400,
      visionPerMin: 1,
    });
  });

  it('a deathless game counts kills plus assists as the KDA', () => {
    const { players } = deriveGameStats(
      game({ blue: [participant('blue-top', { kills: 3, deaths: 0, assists: 4 })] }),
    );
    expect(players.find((p) => p.puuid === 'blue-top')?.kda).toBe(7);
  });

  it('a team without kills has zero participation instead of dividing by zero', () => {
    const quiet = game({
      blue: ['top', 'jungle', 'mid', 'adc', 'support'].map((r) =>
        participant(`blue-${r}`, { kills: 0, assists: 0 }),
      ),
    });
    const { players } = deriveGameStats(quiet);
    expect(players.filter((p) => p.side === 'blue').every((p) => p.killParticipation === 0)).toBe(
      true,
    );
  });

  it('derives the team lines from the objectives and the players', () => {
    const { teams } = deriveGameStats(game());
    expect(teams.find((t) => t.side === 'blue')).toMatchObject({
      entrantId: 'blue',
      win: true,
      kills: 20,
      gold: 67_500,
      towers: 9,
      dragons: 3,
      barons: 1,
      firstBlood: true,
      bans: [1, 2, 3, 4, 5],
    });
    expect(teams.find((t) => t.side === 'red')?.firstBlood).toBe(false);
  });

  it('picks the MVP among the winners, by performance score', () => {
    const { players, mvpPuuid } = deriveGameStats(game());
    expect(mvpPuuid).toBe('blue-mid');
    expect(players.filter((p) => p.isMvp).map((p) => p.puuid)).toEqual(['blue-mid']);
  });

  it('keeps the notable moments: first blood, multikills, first objectives', () => {
    const { events } = deriveGameStats(
      game({ blue: [participant('blue-adc', { pentaKills: 1, quadraKills: 1 })] }),
    );
    expect(events.map((e) => [e.type, e.actorPuuid])).toEqual([
      ['first_blood', 'blue-mid'],
      ['first_tower', null],
      ['first_dragon', null],
      ['first_baron', null],
      ['quadrakill', 'blue-adc'],
      ['pentakill', 'blue-adc'],
    ]);
  });

  it('is deterministic: the same game gives the same lines', () => {
    expect(deriveGameStats(game())).toEqual(deriveGameStats(game()));
  });

  it('rejects a game that cannot be scored', () => {
    expect(() => deriveGameStats({ ...game(), durationSeconds: 0 })).toThrow(InvalidGameStatsError);
    const bothWin = game();
    expect(() =>
      deriveGameStats({ ...bothWin, teams: bothWin.teams.map((t) => ({ ...t, win: true })) }),
    ).toThrow(InvalidGameStatsError);
  });
});

describe('performanceScore', () => {
  it('rewards kills, assists, damage, vision and the win; punishes deaths', () => {
    const base = deriveGameStats(game()).players.find((p) => p.puuid === 'blue-mid');
    if (!base) throw new Error('fixture');
    expect(performanceScore({ ...base, deaths: base.deaths + 3 })).toBeLessThan(
      performanceScore(base),
    );
    expect(performanceScore({ ...base, win: false })).toBeLessThan(performanceScore(base));
  });
});
