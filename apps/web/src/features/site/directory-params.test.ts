import { describe, expect, it } from 'vitest';

import { readDirectoryParams } from './directory-params';

describe('directory params', () => {
  it('reads the search and the page from the URL', () => {
    expect(readDirectoryParams({ q: ' aurora ', pagina: '2' })).toEqual({
      query: { q: 'aurora', page: 2, pageSize: 24 },
      invalid: false,
    });
  });

  it('falls back to the first page instead of breaking', () => {
    expect(readDirectoryParams({ pagina: 'x' }).query.page).toBe(1);
    expect(readDirectoryParams({ pagina: ['3', '4'] }).query.page).toBe(3);
  });

  it('flags a search with characters the directory does not accept', () => {
    expect(readDirectoryParams({ q: 'a,b' })).toEqual({
      query: { q: '', page: 1, pageSize: 24 },
      invalid: true,
    });
  });
});
