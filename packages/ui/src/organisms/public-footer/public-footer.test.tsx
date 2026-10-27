import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PublicFooter } from './public-footer.js';

afterEach(cleanup);

describe('PublicFooter', () => {
  it('shows the legal links, the disclaimer and placeholders that are not links', () => {
    render(
      <PublicFooter
        brand={<span>Liga</span>}
        groups={[
          { title: 'Legal', links: [{ label: 'Privacidad', href: '/legal/privacidad' }] },
          {
            title: 'Comunidad',
            links: [
              { label: 'Discord' },
              { label: 'Correo', href: 'mailto:hola@example.com', external: true },
            ],
          },
        ]}
        disclaimer="Liga no está respaldado por Riot Games."
        labels={{ navigation: 'Pie de página', soon: 'Pronto' }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Privacidad' }).getAttribute('href')).toBe(
      '/legal/privacidad',
    );
    expect(screen.queryByRole('link', { name: /Discord/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Correo' }).getAttribute('rel')).toBe(
      'noopener noreferrer',
    );
    expect(screen.getByText('Liga no está respaldado por Riot Games.')).toBeTruthy();
  });
});
