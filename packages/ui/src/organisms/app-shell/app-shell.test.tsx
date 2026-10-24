import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { AppShell } from './app-shell.js';

afterEach(cleanup);

const props = {
  brand: <span>Liga</span>,
  title: 'Consola',
  nav: [
    { href: '/admin', label: 'Inicio' },
    { href: '/admin/kitchen-sink', label: 'Componentes' },
  ],
  activeHref: '/admin/kitchen-sink',
  labels: { navigation: 'Navegación', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú' },
};

describe('AppShell', () => {
  it('marks the active section', () => {
    render(<AppShell {...props}>Contenido</AppShell>);

    expect(screen.getByRole('link', { name: 'Componentes' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull();
  });

  it('opens the navigation in a sheet on small screens', async () => {
    const user = userEvent.setup();
    render(<AppShell {...props}>Contenido</AppShell>);

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

    // Radix hides the rest of the page from assistive tech while the sheet is open.
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('navigation', { name: 'Navegación' })).toBeTruthy();
  });

  it('uses the app link component when given', () => {
    render(
      <AppShell
        {...props}
        renderLink={(item, linkProps) => <a data-router="yes" href={item.href} {...linkProps} />}
      >
        Contenido
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('data-router')).toBe('yes');
  });
});
