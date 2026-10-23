import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const required = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

describe('loadEnv', () => {
  it('applies defaults for local development', () => {
    expect(loadEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
      APP_VERSION: '0.0.0',
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
    expect(() => loadEnv({})).toThrow(/SUPABASE_URL[\s\S]*SUPABASE_PUBLISHABLE_KEY/);
  });
});
