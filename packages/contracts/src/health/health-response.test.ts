import { describe, expect, it } from 'vitest';

import { HealthResponseSchema } from '../index.js';

describe('HealthResponseSchema', () => {
  const valid = { status: 'ok', version: '0.0.0', timestamp: '2026-01-01T00:00:00.000Z' };

  it('accepts a valid health response', () => {
    expect(HealthResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an unknown status', () => {
    expect(HealthResponseSchema.safeParse({ ...valid, status: 'fine' }).success).toBe(false);
  });

  it('rejects a timestamp that is not ISO 8601', () => {
    expect(HealthResponseSchema.safeParse({ ...valid, timestamp: 'yesterday' }).success).toBe(
      false,
    );
  });
});
