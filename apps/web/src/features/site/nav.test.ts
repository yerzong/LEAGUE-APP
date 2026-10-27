import { describe, expect, it } from 'vitest';

import { accountMenuGroups, activeSection, loginHref, siteNav } from './nav';

describe('public navigation', () => {
  it('lights up the section of nested pages', () => {
    expect(activeSection('/')).toBe('/');
    expect(activeSection('/equipos')).toBe('/equipos');
    expect(activeSection('/equipos/aurora')).toBe('/equipos');
    expect(activeSection('/jugadores/ana')).toBe('/jugadores');
    expect(activeSection('/legal/privacidad')).toBeUndefined();
  });

  it('keeps planned sections in the structure without linking them', () => {
    expect(siteNav.filter((item) => item.soon).map((item) => item.href)).toEqual([
      '/noticias',
      '/en-vivo',
    ]);
    expect(activeSection('/noticias')).toBeUndefined();
  });

  it('shows the console only to staff', () => {
    expect(
      accountMenuGroups(false)
        .flat()
        .map((l) => l.href),
    ).toEqual(['/app', '/app/perfil', '/app/equipos']);
    expect(accountMenuGroups(true).at(-1)).toEqual([{ href: '/admin', key: 'admin' }]);
  });

  it('returns to the current page after login', () => {
    expect(loginHref('/')).toBe('/login');
    expect(loginHref('/equipos/aurora')).toBe('/login?next=%2Fequipos%2Faurora');
  });
});
