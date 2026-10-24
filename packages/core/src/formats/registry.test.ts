import { describe, expect, it } from 'vitest';

import { InvalidFormatConfigError, UnknownFormatError } from '../errors.js';
import { createFormatRegistry, PhaseFormatRegistry } from './registry.js';
import { roundRobin } from './round-robin.js';
import type { PhaseFormatStrategy } from './strategy.js';

const entrants = [
  { id: 'A', seed: 1 },
  { id: 'B', seed: 2 },
  { id: 'C', seed: 3 },
  { id: 'D', seed: 4 },
];

describe('format registry', () => {
  it('resolves every built-in format by its enum value', () => {
    const registry = createFormatRegistry();
    expect(registry.formats()).toEqual([
      'round_robin',
      'double_round_robin',
      'groups',
      'single_elimination',
      'double_elimination',
      'swiss',
    ]);
    expect(registry.get('round_robin')).toBe(roundRobin);
    expect(
      registry.get('single_elimination').generateMatches(entrants, { seriesFormat: 'bo1' }),
    ).toHaveLength(3);
  });

  it('accepts formats read from data and validates their config at runtime', () => {
    const registry = createFormatRegistry();
    const format: string = 'groups';
    const config = JSON.parse('{"seriesFormat":"bo1","groupCount":"two"}') as {
      seriesFormat: 'bo1';
    };
    expect(() => registry.get(format).generateMatches(entrants, config)).toThrow(
      InvalidFormatConfigError,
    );
  });

  it('throws a typed error for an unknown format', () => {
    expect(() => createFormatRegistry().get('gauntlet')).toThrow(UnknownFormatError);
  });

  it('adds a new format without touching the existing ones', () => {
    const custom: PhaseFormatStrategy = { ...roundRobin, format: 'gauntlet' };
    const registry = createFormatRegistry().register(custom);
    expect(registry.get('gauntlet')).toBe(custom);
    expect(registry.get('round_robin')).toBe(roundRobin);
    expect(() => registry.register(custom)).toThrow(InvalidFormatConfigError);
    expect(new PhaseFormatRegistry().formats()).toEqual([]);
  });
});
