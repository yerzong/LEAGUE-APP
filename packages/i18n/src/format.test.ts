import { describe, expect, it } from 'vitest';

import { format } from './format.js';

describe('format', () => {
  it('replaces every placeholder with its value', () => {
    expect(format('{a} y {b}', { a: 'uno', b: 2 })).toBe('uno y 2');
  });

  it('keeps placeholders that have no value', () => {
    expect(format('Hola {name}', {})).toBe('Hola {name}');
  });

  it('returns the template untouched when it has no placeholders', () => {
    expect(format('Sin variables', { a: 'x' })).toBe('Sin variables');
  });
});
