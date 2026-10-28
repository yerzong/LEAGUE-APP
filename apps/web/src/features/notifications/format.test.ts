import { describe, expect, it } from 'vitest';

import { timeAgo } from './format';

const now = new Date('2026-10-27T18:00:00Z');

describe('timeAgo', () => {
  it('speaks in minutes, hours and days', () => {
    expect(timeAgo('2026-10-27T17:55:00Z', now)).toBe('hace 5 minutos');
    expect(timeAgo('2026-10-27T15:00:00Z', now)).toBe('hace 3 horas');
    expect(timeAgo('2026-10-26T18:00:00Z', now)).toBe('ayer');
    expect(timeAgo('2026-10-27T17:59:50Z', now)).toBe('este minuto');
  });

  it('shows the date after a week', () => {
    expect(timeAgo('2026-10-01T18:00:00Z', now)).toMatch(/2026/);
  });
});
