import { describe, expect, it } from 'vitest';

import { plural } from './plural.js';

const teams = { one: '{count} equipo', other: '{count} equipos' };

describe('plural', () => {
  it('picks the form for the count', () => {
    expect(plural(teams, 1)).toBe('1 equipo');
    expect(plural(teams, 0)).toBe('0 equipos');
    expect(plural(teams, 2)).toBe('2 equipos');
  });

  it('formats large numbers for the locale', () => {
    expect(plural(teams, 1200)).toBe('1,200 equipos');
  });
});
