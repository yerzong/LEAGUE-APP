import { describe, expect, it } from 'vitest';

import { assertSeedAllowed, DEV_PROJECT_REF, projectRefOf, SeedRefusedError } from './guard.js';

const dev = {
  SEED_ENABLED: 'true',
  SUPABASE_URL: `https://${DEV_PROJECT_REF}.supabase.co`,
  SUPABASE_SECRET_KEY: 'sb_secret_x',
};

describe('projectRefOf', () => {
  it('reads the ref of a hosted project', () => {
    expect(projectRefOf(`https://${DEV_PROJECT_REF}.supabase.co`)).toBe(DEV_PROJECT_REF);
    expect(projectRefOf(`https://${DEV_PROJECT_REF}.supabase.co/rest/v1`)).toBe(DEV_PROJECT_REF);
  });

  it('is null for anything else', () => {
    expect(projectRefOf(undefined)).toBeNull();
    expect(projectRefOf('not a url')).toBeNull();
    expect(projectRefOf('http://127.0.0.1:54321')).toBeNull();
    expect(projectRefOf(`http://${DEV_PROJECT_REF}.supabase.co`)).toBeNull();
    expect(projectRefOf(`https://${DEV_PROJECT_REF}.supabase.co.evil.com`)).toBeNull();
  });
});

describe('assertSeedAllowed', () => {
  it('lets the seed run on penta-dev with the opt-in', () => {
    expect(() => {
      assertSeedAllowed(dev);
    }).not.toThrow();
  });

  it.each([
    ['production', { ...dev, NODE_ENV: 'production' }],
    ['no opt-in', { ...dev, SEED_ENABLED: undefined }],
    ['opt-in not "true"', { ...dev, SEED_ENABLED: '1' }],
    ['another project', { ...dev, SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' }],
    ['local Supabase', { ...dev, SUPABASE_URL: 'http://127.0.0.1:54321' }],
    ['no secret key', { ...dev, SUPABASE_SECRET_KEY: '' }],
  ])('refuses: %s', (_, env) => {
    expect(() => {
      assertSeedAllowed(env);
    }).toThrow(SeedRefusedError);
  });

  it('never echoes the values it checks', () => {
    const env = { ...dev, SUPABASE_URL: 'https://secretprojectrefxxxxx.supabase.co' };
    expect(() => {
      assertSeedAllowed(env);
    }).toThrow(/^Seed refused: SUPABASE_URL is not the penta-dev project$/);
  });
});
