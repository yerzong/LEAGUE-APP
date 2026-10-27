import { describe, expect, it } from 'vitest';

import { filterHref, readPublicFilter } from './public-filter';

describe('public tournament filter', () => {
  it('reads Spanish URL values and falls back to all', () => {
    expect(readPublicFilter('abiertos')).toBe('open');
    expect(readPublicFilter(['en-curso'])).toBe('live');
    expect(readPublicFilter('nope')).toBe('all');
    expect(readPublicFilter(undefined)).toBe('all');
  });

  it('builds the links back', () => {
    expect(filterHref('all')).toBe('/torneos');
    expect(filterHref('finished')).toBe('/torneos?estado=finalizados');
  });
});
