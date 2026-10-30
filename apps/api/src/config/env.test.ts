import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const required = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};

describe('loadEnv', () => {
  it('applies defaults for local development', () => {
    expect(loadEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
      APP_VERSION: '0.0.0',
      DEFAULT_ORGANIZATION_SLUG: 'penta-league',
      RIOT_PROVIDER: 'stub',
      CHECKIN_SWEEP_SECONDS: 60,
      NOTIFICATIONS_POLL_SECONDS: 5,
      NOTIFICATIONS_MAX_EVENT_AGE_HOURS: 48,
      STATS_POLL_SECONDS: 5,
      CHAMPIONS_PROVIDER: 'ddragon',
      EMAIL_PROVIDER: 'fake',
      DISCORD_PROVIDER: 'stub',
      DISCORD_POLL_SECONDS: 30,
      ...required,
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadEnv({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });

  it('fails fast naming the invalid variables', () => {
    expect(() => loadEnv({ ...required, PORT: 'abc', WEB_ORIGIN: 'not-a-url' })).toThrow(
      /PORT[\s\S]*WEB_ORIGIN/,
    );
  });

  it('requires the Supabase project', () => {
    expect(() => loadEnv({})).toThrow(
      /SUPABASE_URL[\s\S]*SUPABASE_PUBLISHABLE_KEY[\s\S]*SUPABASE_SECRET_KEY/,
    );
  });

  it('needs a Riot API key for the real provider and forbids the stub in production', () => {
    expect(() => loadEnv({ ...required, RIOT_PROVIDER: 'riot' })).toThrow(/RIOT_API_KEY/);
    expect(
      loadEnv({ ...required, RIOT_PROVIDER: 'riot', RIOT_API_KEY: 'RGAPI-x' }).RIOT_PROVIDER,
    ).toBe('riot');
    expect(() => loadEnv({ ...required, NODE_ENV: 'production' })).toThrow(/RIOT_PROVIDER/);
  });

  it('needs the Resend key and sender for real email and forbids the fake in production', () => {
    expect(() => loadEnv({ ...required, EMAIL_PROVIDER: 'resend' })).toThrow(
      /RESEND_API_KEY[\s\S]*EMAIL_FROM/,
    );
    expect(
      loadEnv({
        ...required,
        EMAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_x',
        EMAIL_FROM: 'Liga <no-reply@example.com>',
      }).EMAIL_PROVIDER,
    ).toBe('resend');
    expect(() =>
      loadEnv({ ...required, NODE_ENV: 'production', RIOT_PROVIDER: 'riot', RIOT_API_KEY: 'k' }),
    ).toThrow(/EMAIL_PROVIDER/);
  });

  it('never prints values in the error, only variable names', () => {
    expect(() => loadEnv({ ...required, PORT: 'secret-looking-value' })).not.toThrow(
      /secret-looking-value/,
    );
  });
});
