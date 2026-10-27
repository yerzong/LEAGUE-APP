import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StandingsTable } from './standings-table.js';

afterEach(cleanup);

describe('StandingsTable', () => {
  it('lists the rows with their values and the tiebreak note', () => {
    render(
      <StandingsTable
        caption="Grupo A"
        rankLabel="#"
        entrantLabel="Equipo"
        columns={[
          { key: 'played', label: 'PJ', title: 'Jugados' },
          { key: 'points', label: 'Pts' },
        ]}
        rows={[
          {
            id: 'a',
            rank: 1,
            entrant: 'Aurora',
            values: [3, 6],
            note: 'Desempate: resultado directo',
          },
          { id: 'b', rank: 2, entrant: 'Boreal', values: [3, 6], highlight: 'eliminated' },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Grupo A' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]?.textContent).toContain('Aurora');
    expect(screen.getByText('Desempate: resultado directo')).toBeTruthy();
    expect(screen.getByTitle('Jugados')).toBeTruthy();
    expect(rows[2]?.getAttribute('data-highlight')).toBe('eliminated');
  });
});
