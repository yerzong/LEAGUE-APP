import { defaultPhase } from '@league/contracts';
import { describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../shared/application-error.js';
import { PNG_BYTES } from '../../identity/testing/fake-image-storage.js';
import {
  ADMIN,
  captainOf,
  ENTRANTS,
  setup,
  STRANGER,
  TOURNAMENT,
} from '../testing/competition-fixture.js';
import {
  CheckinSweepUseCase,
  CheckInUseCase,
  GenerateFixturesUseCase,
  GetMatchUseCase,
  ListMyMatchesUseCase,
  OpenDisputeUseCase,
  ReportResultUseCase,
  ResolveDisputeUseCase,
  RunMatchActionUseCase,
  StaffForfeitUseCase,
  StaffResultUseCase,
  UploadEvidenceUseCase,
} from './matches.use-cases.js';

async function rejects(promise: Promise<unknown>, code: string) {
  const error: unknown = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
  const actual =
    error instanceof ApplicationError
      ? error.code
      : ((error as { details?: { reason?: string } }).details?.reason ??
        (error as { code?: string }).code);
  expect(actual).toBe(code);
}

const games = (...winners: ('a' | 'b')[]) =>
  winners.map((winner, i) => ({ number: i + 1, winner }));

async function started(...args: Parameters<typeof setup>) {
  const ctx = setup(...args);
  await new GenerateFixturesUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
  return ctx;
}

/** Staff opens the check-in and both captains check in (core requires it before results). */
async function ready(ctx: ReturnType<typeof setup>, matchId: string) {
  const match = ctx.matches.matches.find((m) => m.id === matchId);
  if (!match?.entrantA || !match.entrantB) throw new Error('match not ready');
  await new RunMatchActionUseCase(ctx.deps).execute(ADMIN, matchId, 'open_checkin');
  const checkIn = new CheckInUseCase(ctx.deps);
  await checkIn.execute(captainOf(match.entrantA), matchId);
  await checkIn.execute(captainOf(match.entrantB), matchId);
  return { a: match.entrantA, b: match.entrantB, format: match.seriesFormat };
}

/** Check-in, then both captains report the same result. */
async function play(ctx: ReturnType<typeof setup>, matchId: string, winner: 'a' | 'b') {
  const match = ctx.matches.matches.find((m) => m.id === matchId);
  if (!match?.entrantA || !match.entrantB) throw new Error('match not ready');
  await ready(ctx, matchId);
  const report = new ReportResultUseCase(ctx.deps);
  const result = games(
    ...Array.from({ length: match.seriesFormat === 'bo1' ? 1 : 2 }, () => winner),
  );
  await report.execute(captainOf(match.entrantA), matchId, { games: result, evidencePaths: [] });
  return report.execute(captainOf(match.entrantB), matchId, { games: result, evidencePaths: [] });
}

const round = (ctx: ReturnType<typeof setup>, r: number) =>
  ctx.matches.matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position);

describe('GenerateFixturesUseCase', () => {
  it('creates the single elimination bracket from the seeded registrations', async () => {
    const ctx = await started();
    expect(ctx.matches.matches.map((m) => [m.bracketKey, m.entrantA, m.entrantB])).toEqual([
      ['r1-m1', ENTRANTS[0], ENTRANTS[3]],
      ['r1-m2', ENTRANTS[1], ENTRANTS[2]],
      ['r2-m1', null, null],
    ]);
    // Bracket links: both semifinal winners go to the final.
    const final = round(ctx, 2)[0];
    expect(round(ctx, 1).map((m) => m.nextWinnerId)).toEqual([final?.id, final?.id]);
    expect(ctx.tournamentRepo.tournaments[0]?.status).toBe('in_progress');
    expect(ctx.matches.standings_).toHaveLength(4);
    expect(ctx.matches.events).toEqual(
      expect.arrayContaining(['tournament.started', 'tournament.fixtures_generated']),
    );
  });

  it('creates every pairing of a round robin', async () => {
    const ctx = await started([defaultPhase('round_robin', 'Liga')]);
    expect(ctx.matches.matches).toHaveLength(6);
    expect(new Set(ctx.matches.matches.map((m) => m.round))).toEqual(new Set([1, 2, 3]));
  });

  it('needs staff, closed registration and seeds', async () => {
    const ctx = setup();
    const generate = new GenerateFixturesUseCase(ctx.deps);
    await rejects(generate.execute(STRANGER, TOURNAMENT), 'staff_only');
    await rejects(setupGenerate({ status: 'registration_open' }), 'invalid_transition');
    await rejects(setupGenerate({ seeded: false }), 'seeding_required');
    await generate.execute(ADMIN, TOURNAMENT);
    await rejects(generate.execute(ADMIN, TOURNAMENT), 'invalid_transition');
  });
});

function setupGenerate(options: Parameters<typeof setup>[1]) {
  const ctx = setup(undefined, options);
  return new GenerateFixturesUseCase(ctx.deps).execute(ADMIN, TOURNAMENT);
}

describe('check-in', () => {
  it('opens on staff action, takes both captains and readies the match', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA || !semi.entrantB) throw new Error('fixture');
    const checkIn = new CheckInUseCase(ctx.deps);
    await rejects(checkIn.execute(captainOf(semi.entrantA), semi.id), 'checkin_closed');
    await new RunMatchActionUseCase(ctx.deps).execute(ADMIN, semi.id, 'open_checkin');
    await rejects(checkIn.execute(STRANGER, semi.id), 'not_match_party');
    await checkIn.execute(captainOf(semi.entrantA), semi.id);
    await rejects(checkIn.execute(captainOf(semi.entrantA), semi.id), 'already_checked_in');
    const detail = await checkIn.execute(captainOf(semi.entrantB), semi.id);
    expect(detail.status).toBe('ready');
    expect(detail.checkedIn).toEqual([semi.entrantA, semi.entrantB]);
  });

  it('forfeits whoever did not check in when the window closes, and the bracket advances', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA || !semi.entrantB) throw new Error('fixture');
    const action = new RunMatchActionUseCase(ctx.deps);
    await action.execute(ADMIN, semi.id, 'open_checkin');
    await new CheckInUseCase(ctx.deps).execute(captainOf(semi.entrantA), semi.id);
    await action.execute(ADMIN, semi.id, 'close_checkin');

    const done = ctx.matches.matches.find((m) => m.id === semi.id);
    expect(done).toMatchObject({
      status: 'forfeit',
      winnerId: semi.entrantA,
      resultSource: 'checkin_forfeit',
    });
    expect(round(ctx, 2)[0]?.entrantA).toBe(semi.entrantA);
    expect(ctx.matches.standings_.find((s) => s.entrantId === semi.entrantB)?.status).toBe(
      'eliminated',
    );
    expect(ctx.matches.events).toContain('match.forfeited');
  });

  it('opens and closes on its own on schedule (sweeper)', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi) throw new Error('fixture');
    const m = ctx.matches.matches.find((x) => x.id === semi.id);
    if (!m) throw new Error('fixture');
    m.checkinOpensAt = new Date('2026-11-14T18:10:00.000Z');
    m.checkinClosesAt = new Date('2026-11-14T18:20:00.000Z');
    const sweep = new CheckinSweepUseCase(ctx.deps);
    expect(await sweep.execute()).toEqual({ opened: 0, closed: 0 });
    ctx.advance(10);
    expect(await sweep.execute()).toEqual({ opened: 1, closed: 0 });
    ctx.advance(10);
    expect(await sweep.execute()).toEqual({ opened: 0, closed: 1 });
    // Nobody checked in: staff decides.
    expect(ctx.matches.matches.find((x) => x.id === semi.id)?.status).toBe('checkin');
    expect(ctx.matches.events).toContain('match.no_show');
  });
});

describe('dual report', () => {
  it('confirms matching reports, advances the bracket and recomputes the standings', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA || !semi.entrantB) throw new Error('fixture');
    await ready(ctx, semi.id);
    const report = new ReportResultUseCase(ctx.deps);
    const first = await report.execute(captainOf(semi.entrantA), semi.id, {
      games: games('a'),
      evidencePaths: [],
    });
    expect(first.status).toBe('awaiting_result');
    const second = await report.execute(captainOf(semi.entrantB), semi.id, {
      games: games('a'),
      evidencePaths: [],
    });
    expect(second).toMatchObject({
      status: 'completed',
      winnerId: semi.entrantA,
      scoreA: 1,
      resultSource: 'dual_report',
    });
    expect(second.games).toEqual([{ number: 1, winnerId: semi.entrantA }]);
    expect(round(ctx, 2)[0]?.entrantA).toBe(semi.entrantA);
    expect(ctx.matches.standings_.find((s) => s.entrantId === semi.entrantA)).toMatchObject({
      wins: 1,
      played: 1,
    });
    expect(ctx.matches.events).toEqual(
      expect.arrayContaining(['match.result_reported', 'match.completed']),
    );
  });

  it('opens a dispute when the reports differ, and staff resolves it with an audited override', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA || !semi.entrantB) throw new Error('fixture');
    await ready(ctx, semi.id);
    const report = new ReportResultUseCase(ctx.deps);
    await report.execute(captainOf(semi.entrantA), semi.id, {
      games: games('a'),
      evidencePaths: [],
    });
    const disputed = await report.execute(captainOf(semi.entrantB), semi.id, {
      games: games('b'),
      evidencePaths: [],
    });
    expect(disputed.status).toBe('disputed');
    const [dispute] = disputed.disputes;
    if (!dispute) throw new Error('no dispute');

    const resolved = await new ResolveDisputeUseCase(ctx.deps).execute(ADMIN, dispute.id, {
      resolution: 'La captura del lobby muestra la victoria de B',
      outcome: 'override',
      games: games('b'),
    });
    expect(resolved).toMatchObject({
      status: 'completed',
      winnerId: semi.entrantB,
      resultSource: 'admin_override',
    });
    expect(resolved.disputes[0]?.status).toBe('resolved');
    expect(
      ctx.matches.audit.map((a) => a.action).filter((a) => a !== 'tournament.started'),
    ).toEqual(['dispute.resolved', 'match.result.override']);
    expect(round(ctx, 2)[0]?.entrantA).toBe(semi.entrantB);
  });

  it('refuses an impossible report and reports from outsiders', async () => {
    const ctx = await started([
      {
        ...defaultPhase('single_elimination', 'Eliminación'),
        seriesFormat: 'bo3',
        finalSeriesFormat: 'bo3',
      },
    ]);
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA) throw new Error('fixture');
    await ready(ctx, semi.id);
    const report = new ReportResultUseCase(ctx.deps);
    await rejects(
      report.execute(captainOf(semi.entrantA), semi.id, { games: games('a'), evidencePaths: [] }),
      'invalid_report',
    );
    await rejects(
      report.execute(STRANGER, semi.id, { games: games('a', 'a'), evidencePaths: [] }),
      'not_match_party',
    );
  });

  it('lets a captain dispute a confirmed result inside the window only', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantB) throw new Error('fixture');
    await play(ctx, semi.id, 'a');
    const open = new OpenDisputeUseCase(ctx.deps);
    const disputed = await open.execute(captainOf(semi.entrantB), semi.id, {
      category: 'result',
      description: 'Un jugador del rival no estaba inscrito',
    });
    expect(disputed.status).toBe('disputed');

    const [dispute] = disputed.disputes;
    if (!dispute) throw new Error('no dispute');
    const kept = await new ResolveDisputeUseCase(ctx.deps).execute(ADMIN, dispute.id, {
      resolution: 'El jugador sí estaba en el roster congelado',
      outcome: 'keep',
      games: null,
    });
    expect(kept).toMatchObject({ status: 'completed', winnerId: semi.entrantA });

    ctx.advance(25 * 60);
    await rejects(
      open.execute(captainOf(semi.entrantB), semi.id, {
        category: 'result',
        description: 'Otra vez, más tarde',
      }),
      'dispute_window_closed',
    );
  });
});

describe('staff results', () => {
  it('confirms a result with a reason, or forfeits an entrant', async () => {
    const ctx = await started();
    const [semi1, semi2] = round(ctx, 1);
    if (!semi1 || !semi2) throw new Error('fixture');
    await ready(ctx, semi1.id);
    await rejects(
      new StaffResultUseCase(ctx.deps).execute(STRANGER, semi1.id, {
        games: games('a'),
        reason: 'Referee confirmó',
      }),
      'staff_only',
    );
    const confirmed = await new StaffResultUseCase(ctx.deps).execute(ADMIN, semi1.id, {
      games: games('b'),
      reason: 'El referee confirmó en el lobby',
    });
    expect(confirmed).toMatchObject({
      status: 'completed',
      resultSource: 'referee',
      winnerId: semi1.entrantB,
    });
    const forfeited = await new StaffForfeitUseCase(ctx.deps).execute(ADMIN, semi2.id, {
      loser: 'b',
      reason: 'No se presentó al lobby',
    });
    expect(forfeited).toMatchObject({ status: 'forfeit', winnerId: semi2.entrantA });
    expect(
      ctx.matches.audit.map((a) => a.action).filter((a) => a !== 'tournament.started'),
    ).toEqual(['match.result.confirmed', 'match.forfeited']);
  });
});

describe('a flash tournament from fixtures to champion', () => {
  it('plays every match and completes the tournament with its champion', async () => {
    const ctx = await started();
    for (const semi of round(ctx, 1)) await play(ctx, semi.id, 'a');
    const [final] = round(ctx, 2);
    if (!final) throw new Error('fixture');
    await play(ctx, final.id, 'b');

    expect(ctx.tournamentRepo.tournaments[0]?.status).toBe('completed');
    expect(ctx.matches.events).toEqual(
      expect.arrayContaining(['phase.completed', 'tournament.completed']),
    );
    const champion = ctx.matches.standings_.find((s) => s.rank === 1);
    expect(champion?.entrantId).toBe(ENTRANTS[1]);
    expect(champion?.status).toBe('qualified');
  });

  it('starts the next phase with the qualified entrants of a round robin', async () => {
    const ctx = await started([
      { ...defaultPhase('round_robin', 'Liga'), advance: 2 },
      defaultPhase('single_elimination', 'Final'),
    ]);
    const league = [...ctx.matches.matches];
    for (const match of league) {
      // The lower id always wins: entrants 1 and 2 qualify.
      const a = match.entrantA ?? '';
      const b = match.entrantB ?? '';
      await play(ctx, match.id, a < b ? 'a' : 'b');
    }
    const final = ctx.matches.matches.filter((m) => !league.some((l) => l.id === m.id));
    expect(final.map((m) => [m.entrantA, m.entrantB])).toEqual([[ENTRANTS[0], ENTRANTS[1]]]);
    const table = ctx.matches.standings_.filter((s) => s.phaseId === league[0]?.phaseId);
    expect(table.sort((x, y) => x.rank - y.rank).map((s) => [s.entrantId, s.status])).toEqual([
      [ENTRANTS[0], 'qualified'],
      [ENTRANTS[1], 'qualified'],
      [ENTRANTS[2], 'eliminated'],
      [ENTRANTS[3], 'eliminated'],
    ]);
    expect(ctx.matches.events).toContain('phase.started');
  });
});

describe('reads and evidence', () => {
  it('shows permissions to the parties and the public view to others', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA) throw new Error('fixture');
    await new RunMatchActionUseCase(ctx.deps).execute(ADMIN, semi.id, 'open_checkin');
    const get = new GetMatchUseCase(ctx.deps);
    const party = await get.execute(captainOf(semi.entrantA), semi.id);
    expect(party.permissions).toMatchObject({
      entrantId: semi.entrantA,
      canCheckIn: true,
      canReport: false,
    });
    const anonymous = await get.execute(null, semi.id);
    expect(anonymous.permissions).toBeNull();
    expect(anonymous.reports).toEqual([]);

    const mine = await new ListMyMatchesUseCase(ctx.deps).execute(captainOf(semi.entrantA));
    expect(mine.map((m) => m.id)).toEqual([semi.id]);
  });

  it('stores evidence in the private bucket under the match', async () => {
    const ctx = await started();
    const [semi] = round(ctx, 1);
    if (!semi?.entrantA) throw new Error('fixture');
    const upload = new UploadEvidenceUseCase(ctx.deps);
    const { path } = await upload.execute(captainOf(semi.entrantA), semi.id, {
      buffer: PNG_BYTES,
      size: PNG_BYTES.length,
    });
    expect(path.startsWith(`${semi.id}/`)).toBe(true);
    expect(path.endsWith('.png')).toBe(true);
    await rejects(
      upload.execute(STRANGER, semi.id, { buffer: PNG_BYTES, size: PNG_BYTES.length }),
      'not_match_party',
    );
  });
});
