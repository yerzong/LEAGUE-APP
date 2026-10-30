import { describe, expect, it } from 'vitest';

import { decimal, duration, gamesLabel, percent, record, shortDay, winRate } from './format';

describe('stats format', () => {
  it('formats numbers, rates and durations for es-419', () => {
    expect(decimal(4.849)).toBe('4.8');
    expect(decimal(612.4, 0)).toBe('612');
    expect(percent(0.613)).toMatch(/^61\s?%$/);
    expect(winRate(3, 4)).toBe(0.75);
    expect(winRate(0, 0)).toBe(0);
    expect(duration(1935)).toBe('32:15');
    expect(duration(61)).toBe('1:01');
  });

  it('labels games, records and days', () => {
    expect(gamesLabel(1)).toBe('1 game');
    expect(gamesLabel(12)).toBe('12 games');
    expect(record(5, 2)).toBe('5V – 2D');
    expect(shortDay('2026-10-05')).toMatch(/^5 oct/);
  });
});
