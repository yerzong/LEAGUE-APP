import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults for local development', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
      APP_VERSION: '0.0.0',
    });
  });

  it('coerces PORT to a number', () => {
    expect(loadEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('fails fast naming the invalid variables', () => {
    expect(() => loadEnv({ PORT: 'abc', WEB_ORIGIN: 'not-a-url' })).toThrow(
      /PORT[\s\S]*WEB_ORIGIN/,
    );
  });
});
