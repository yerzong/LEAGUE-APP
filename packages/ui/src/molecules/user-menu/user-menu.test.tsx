import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserMenu } from './user-menu.js';

afterEach(cleanup);

describe('UserMenu', () => {
  it('lists the account links and signs out', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(
      <UserMenu
        name="Ana López"
        detail="@ana"
        initials="AL"
        groups={[
          [
            { href: '/app', label: 'Mi portal' },
            { href: '/app/perfil', label: 'Mi perfil' },
          ],
          [{ href: '/admin', label: 'Consola' }],
        ]}
        onSignOut={onSignOut}
        labels={{ trigger: 'Menú de cuenta', signOut: 'Cerrar sesión' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Menú de cuenta' }));

    expect(screen.getByRole('menuitem', { name: 'Mi portal' }).getAttribute('href')).toBe('/app');
    expect(screen.getByRole('menuitem', { name: 'Consola' }).getAttribute('href')).toBe('/admin');
    expect(screen.getByText('@ana')).toBeTruthy();

    await user.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
