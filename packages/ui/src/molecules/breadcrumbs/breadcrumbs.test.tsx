import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Breadcrumbs } from './breadcrumbs.js';

afterEach(cleanup);

describe('Breadcrumbs', () => {
  it('links the trail and marks the current page', () => {
    render(
      <Breadcrumbs
        label="Ruta"
        items={[
          { label: 'Equipos', href: '/equipos' },
          { label: 'Aurora', href: '/equipos/aurora' },
          { label: 'Ana' },
        ]}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Ruta' })).toBeTruthy();
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/equipos',
      '/equipos/aurora',
    ]);
    expect(screen.getByText('Ana').getAttribute('aria-current')).toBe('page');
  });
});
