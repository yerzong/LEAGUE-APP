import { describe, expect, it } from 'vitest';

import {
  failureReason,
  formatMoney,
  fromZonedInput,
  phaseDetail,
  rankLabel,
  ruleSummary,
  toZonedInput,
} from './format';

describe('event time zone inputs', () => {
  it('round-trips a datetime-local value in the event time zone', () => {
    const iso = fromZonedInput('2026-11-14T18:00', 'America/Mexico_City');
    expect(iso).toBe('2026-11-15T00:00:00.000Z');
    expect(toZonedInput(iso, 'America/Mexico_City')).toBe('2026-11-14T18:00');
    expect(toZonedInput('2026-11-15T00:00:00.000Z', 'America/Santiago')).toBe('2026-11-14T21:00');
  });

  it('treats empty values as null', () => {
    expect(fromZonedInput('', 'America/Mexico_City')).toBeNull();
    expect(toZonedInput(null, 'America/Mexico_City')).toBe('');
  });
});

describe('ranks and money', () => {
  it('names ranks from the engine format and from rank objects', () => {
    expect(rankLabel('platinum_4')).toBe('Platino IV');
    expect(rankLabel('master')).toBe('Maestro');
    expect(rankLabel({ tier: 'gold', division: 1 })).toBe('Oro I');
  });

  it('formats MXN from cents', () => {
    expect(formatMoney(500000)).toContain('5,000');
  });
});

describe('eligibility texts', () => {
  it('fills the reason with readable ranks', () => {
    expect(
      failureReason({ reason: 'rank_above_max', details: { rank: 'master', max: 'diamond_1' } }),
    ).toBe('Rango (Maestro) por encima del máximo (Diamante I).');
    expect(failureReason({ reason: 'underage', details: { min: 16 } })).toBe(
      'No cumple la edad mínima (16 años).',
    );
    expect(failureReason({ reason: 'no_such_reason', details: {} })).toBe(
      'Algo salió mal. Inténtalo de nuevo.',
    );
  });

  it('summarizes configured rules', () => {
    expect(ruleSummary({ type: 'region', params: { regions: ['la1', 'la2'] } })).toContain(', ');
    expect(
      ruleSummary({
        type: 'rank_max',
        params: { rank: { tier: 'diamond', division: 1 } },
        appliesTo: 'team_average',
      }),
    ).toBe('Promedio del equipo · Rango máximo: Diamante I.');
    expect(ruleSummary({ type: 'age_min', params: { years: 16 } })).toBe('Edad mínima: 16 años.');
  });

  it('describes a phase', () => {
    expect(
      phaseDetail({
        format: 'single_elimination',
        seriesFormat: 'bo1',
        finalSeriesFormat: 'bo3',
        draftMode: 'standard',
      }),
    ).toBe('Eliminación simple · Bo1 (final Bo3) · Draft estándar');
  });
});
