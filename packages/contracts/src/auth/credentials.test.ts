import { describe, expect, it } from 'vitest';

import { MagicLinkSchema, OAuthProviderSchema, SignUpSchema } from '../index.js';

describe('auth schemas', () => {
  it('normalizes the email', () => {
    expect(MagicLinkSchema.parse({ email: '  Ana@Test.Local ' }).email).toBe('ana@test.local');
  });

  it('rejects an invalid email', () => {
    expect(MagicLinkSchema.safeParse({ email: 'ana' }).success).toBe(false);
  });

  it('requires sign-up passwords between 8 and 72 characters', () => {
    expect(SignUpSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
    expect(SignUpSchema.safeParse({ email: 'a@b.co', password: 'x'.repeat(73) }).success).toBe(
      false,
    );
    expect(SignUpSchema.safeParse({ email: 'a@b.co', password: 'long-enough' }).success).toBe(true);
  });

  it('accepts only the supported OAuth providers', () => {
    expect(OAuthProviderSchema.safeParse('discord').success).toBe(true);
    expect(OAuthProviderSchema.safeParse('github').success).toBe(false);
  });
});
