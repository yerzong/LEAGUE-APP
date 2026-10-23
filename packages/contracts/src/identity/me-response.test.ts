import { describe, expect, it } from 'vitest';

import { MeResponseSchema } from '../index.js';

describe('MeResponseSchema', () => {
  const id = '01920000-0000-7000-8000-0000000000a1';

  it('accepts a user with or without email', () => {
    expect(MeResponseSchema.safeParse({ id, email: 'ana@test.local' }).success).toBe(true);
    expect(MeResponseSchema.safeParse({ id, email: null }).success).toBe(true);
  });

  it('rejects an id that is not a uuid', () => {
    expect(MeResponseSchema.safeParse({ id: 'abc', email: null }).success).toBe(false);
  });
});
