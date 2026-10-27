import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Bracket } from './bracket.js';

afterEach(cleanup);

describe('Bracket', () => {
  it('shows each round with its matches, scores and links', () => {
    render(
      <Bracket
        label="Bracket"
        rounds={[
          {
            id: 'r1',
            title: 'Semifinales',
            matches: [
              {
                id: 'm1',
                a: { name: 'Aurora', score: 1, winner: true },
                b: { name: 'Boreal', score: 0 },
                href: '/partidas/m1',
              },
            ],
          },
          {
            id: 'r2',
            title: 'Final',
            matches: [
              { id: 'm2', a: { name: 'Aurora' }, b: { name: 'Ganador de S2', placeholder: true } },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Bracket' })).toBeTruthy();
    expect(screen.getByText('Semifinales')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/partidas/m1');
    expect(screen.getAllByText('Aurora')).toHaveLength(2);
    expect(screen.getByText('Ganador de S2')).toBeTruthy();
  });
});
