import { describe, expect, it } from 'vitest';

import {
  DisputeEvidenceRequestSchema,
  ReportResultRequestSchema,
  ResolveDisputeRequestSchema,
  RescheduleRequestSchema,
} from './competition.js';

describe('competition requests', () => {
  it('takes the reported games in order', () => {
    expect(
      ReportResultRequestSchema.parse({
        games: [
          { number: 1, winner: 'a' },
          { number: 2, winner: 'a' },
        ],
      }),
    ).toEqual({
      games: [
        { number: 1, winner: 'a' },
        { number: 2, winner: 'a' },
      ],
      evidencePaths: [],
    });
    expect(
      ReportResultRequestSchema.safeParse({ games: [{ number: 2, winner: 'a' }] }).success,
    ).toBe(false);
    expect(ReportResultRequestSchema.safeParse({ games: [] }).success).toBe(false);
  });

  it('only accepts evidence paths of our own uploads', () => {
    const games = [{ number: 1, winner: 'b' }];
    expect(
      ReportResultRequestSchema.safeParse({ games, evidencePaths: ['../../etc/passwd'] }).success,
    ).toBe(false);
    expect(
      ReportResultRequestSchema.safeParse({
        games,
        evidencePaths: [
          '01a17e8f-ef6e-76d0-87e8-444197fd54c3/01a17e8f-ef63-78ef-befc-da16d51fb94a.png',
        ],
      }).success,
    ).toBe(true);
  });

  it('needs some evidence, a resolution and one to three proposals', () => {
    expect(DisputeEvidenceRequestSchema.safeParse({}).success).toBe(false);
    expect(DisputeEvidenceRequestSchema.parse({ note: 'Captura del lobby' }).note).toBe(
      'Captura del lobby',
    );
    expect(DisputeEvidenceRequestSchema.safeParse({ url: 'http://x.mx' }).success).toBe(false);
    expect(
      ResolveDisputeRequestSchema.parse({ resolution: 'Se confirma el marcador', outcome: 'keep' })
        .games,
    ).toBeNull();
    expect(RescheduleRequestSchema.safeParse({ proposedAt: [] }).success).toBe(false);
  });
});
