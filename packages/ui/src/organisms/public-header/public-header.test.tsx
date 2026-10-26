import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PublicHeader } from './public-header.js';

afterEach(cleanup);

const props = {
  brand: <a href="/">Liga</a>,
  nav: [
    { href: '/', label: 'Inicio' },
    { href: '/equipos', label: 'Equipos' },
    { href: '/noticias', label: 'Noticias', soon: true },
  ],
  activeHref: '/equipos',
  labels: {
    navigation: 'Navegación principal',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    soon: 'Pronto',
  },
  actions: <a href="/login">Iniciar sesión</a>,
  menuActions: <a href="/register">Registrarte</a>,
};

describe('PublicHeader', () => {
  it('marks the active section and never links a section that does not exist yet', () => {
    render(<PublicHeader {...props} />);
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });

    expect(within(nav).getByRole('link', { name: 'Equipos' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(nav).queryByRole('link', { name: /Noticias/ })).toBeNull();
    expect(within(nav).getByText('Noticias').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeTruthy();
  });

  it('opens the navigation and the sign-in actions in a sheet on small screens', async () => {
    const user = userEvent.setup();
    render(<PublicHeader {...props} />);

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('link', { name: 'Inicio' })).toBeTruthy();
    expect(within(sheet).getByRole('link', { name: 'Registrarte' })).toBeTruthy();

    await user.click(within(sheet).getByRole('link', { name: 'Inicio' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses the app link component when given', () => {
    render(
      <PublicHeader
        {...props}
        renderLink={(linkProps) => <a data-router="yes" {...linkProps} />}
      />,
    );
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('data-router')).toBe('yes');
  });
});
