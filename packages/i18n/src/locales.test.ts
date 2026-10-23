import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, getMessages, isLocale } from './index.js';

describe('locales', () => {
  it('defaults to Latin American Spanish', () => {
    expect(DEFAULT_LOCALE).toBe('es-419');
  });

  it('recognizes only supported locales', () => {
    expect(isLocale('es-419')).toBe(true);
    expect(isLocale('en-US')).toBe(false);
  });

  it('returns the catalog for a locale', () => {
    expect(getMessages('es-419').health.status.ok).toBe('ok');
  });
});
