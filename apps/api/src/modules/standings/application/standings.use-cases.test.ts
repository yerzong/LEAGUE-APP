import { defaultPhase } from '@league/contracts';
import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../shared/application-error.js';
import {
  CheckInUseCase,
  GenerateFixturesUseCase,
  ReportResultUseCase,
  RunMatchActionUseCase,
} from '../../matches/application/matches.use-cases.js';
import {
  ADMIN,
  captainOf,
  ENTRANTS,
  setup,
  STRANGER,
  TOURNAMENT,
} from '../../matches/testing/competition-fixture.js';
import { GetAdminBoardUseCase, GetPublicBoardUseCase } from './standings.use-cases.js';

async function play(ctx: ReturnType<typeof setup>, matchId: string, winner: 'a' | 'b') {
  const match = ctx.matches.matches.find((m) => m.id === matchId);
  if (!match?.entrantA || !match.entrantB) throw new Error('fixture');
  await new RunMatchActionUseCase(ctx.deps).execute(ADMIN, matchId, 'open_checkin');
  await new CheckInUseCase(ctx.deps).execute(captainOf(match.entrantA), matchId);
  await new CheckInUseCase(ctx.deps).execute(captainOf(match.entrantB), matchId);
  const report = new ReportResultUseCase(ctx.deps);
  const games = [{ number: 1, winner }];
  await report.execute(captainOf(match.entrantA), matchId, { games, evidencePaths: [] });
  await report.execute(captainOf(match.entrantB), matchId, { games, evidencePaths: [] });
}

describe('boards', () => {
  it('shows the round robin table with the tiebreak detail of packages/core', async () => {
    const ctx = setup([{ ...defaultPhase('round_robin', 'Liga'), seriesFormat: 'bo1' }]);
    await new GenerateFixturesUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
    // 1 beats 2, 2 beats 3, 3 beats 1: three entrants level on points.
    const wins: Record<string, string> = {
      [`${ENTRANTS[0] ?? ''}${ENTRANTS[1] ?? ''}`]: ENTRANTS[0] ?? '',
      [`${ENTRANTS[1] ?? ''}${ENTRANTS[2] ?? ''}`]: ENTRANTS[1] ?? '',
      [`${ENTRANTS[0] ?? ''}${ENTRANTS[2] ?? ''}`]: ENTRANTS[2] ?? '',
    };
    for (const m of [...ctx.matches.matches]) {
      const [x, y] = [m.entrantA ?? '', m.entrantB ?? ''].sort();
      const winner =
        wins[`${x ?? ''}${y ?? ''}`] ?? (m.entrantA === ENTRANTS[3] ? m.entrantB : m.entrantA);
      await play(ctx, m.id, winner === m.entrantA ? 'a' : 'b');
    }
    const board = await new GetAdminBoardUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
    const table = board.phases[0]?.groups[0]?.standings ?? [];
    expect(table).toHaveLength(4);
    expect(table.at(-1)?.entrant.id).toBe(ENTRANTS[3]);
    // The three-way tie on points was ordered by the tiebreak criteria, and it says so.
    expect(table.slice(0, 3).every((row) => row.points === 6)).toBe(true);
    expect(
      table.slice(0, 3).some((row) => row.tiebreaks.length > 0 || row.tiedWith.length > 0),
    ).toBe(true);
    expect(board.champion?.id).toBe(table[0]?.entrant.id);
    expect(board.status).toBe('completed');
    await expect(
      new GetAdminBoardUseCase(ctx.deps).execute(STRANGER, TOURNAMENT),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it('shows the bracket publicly, and says when fixtures can be generated', async () => {
    const ctx = setup();
    const publicBoard = new GetPublicBoardUseCase(ctx.deps);
    expect((await publicBoard.execute('relampago')).canGenerateFixtures).toBe(true);
    await new GenerateFixturesUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
    const board = await publicBoard.execute('relampago');
    expect(board.canGenerateFixtures).toBe(false);
    expect(
      board.phases[0]?.matches.map((m) => [m.bracketKey, m.entrantA?.displayName ?? null]),
    ).toEqual([
      ['r1-m1', 'Equipo 1'],
      ['r1-m2', 'Equipo 2'],
      ['r2-m1', null],
    ]);
    expect(board.phases[0]?.matches[2]?.sourceA).toEqual({
      bracketKey: 'r1-m1',
      outcome: 'winner',
    });
    await expect(publicBoard.execute('no-existe')).rejects.toBeInstanceOf(ApplicationError);
  });
});
