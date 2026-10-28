import { describe, expect, it } from 'vitest';

import { DEV_PROJECT_REF, devToolsEnabled } from './enabled';

const devUrl = `https://${DEV_PROJECT_REF}.supabase.co`;

describe('devToolsEnabled', () => {
  it('is on with the flag and penta-dev', () => {
    expect(devToolsEnabled('true', devUrl)).toBe(true);
  });

  it.each([
    ['flag missing', undefined, devUrl],
    ['flag false', 'false', devUrl],
    ['flag not exactly true', '1', devUrl],
    ['production project', 'true', 'https://abcdefghijklmnopqrst.supabase.co'],
    ['look-alike host', 'true', `https://${DEV_PROJECT_REF}.supabase.co.example.com`],
    ['plain http', 'true', `http://${DEV_PROJECT_REF}.supabase.co`],
    ['local Supabase', 'true', 'http://127.0.0.1:54321'],
    ['no URL', 'true', undefined],
    ['invalid URL', 'true', 'not a url'],
  ])('is off: %s', (_, flag, url) => {
    expect(devToolsEnabled(flag, url)).toBe(false);
  });
});
