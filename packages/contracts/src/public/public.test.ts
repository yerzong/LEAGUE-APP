import { describe, expect, it } from 'vitest';

import { DirectoryQuerySchema } from './public.js';

describe('directory query', () => {
  it('defaults to the first page and an empty search', () => {
    expect(DirectoryQuerySchema.parse({})).toEqual({ q: '', page: 1, pageSize: 24 });
  });

  it('reads the query string values', () => {
    expect(DirectoryQuerySchema.parse({ q: '  Ñandú 7 ', page: '3', pageSize: '10' })).toEqual({
      q: 'Ñandú 7',
      page: 3,
      pageSize: 10,
    });
  });

  it('rejects characters that could break the search filter', () => {
    for (const q of ['a,b', 'a(b)', 'a"b', '%', 'a*']) {
      expect(DirectoryQuerySchema.safeParse({ q }).success).toBe(false);
    }
    expect(DirectoryQuerySchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});
