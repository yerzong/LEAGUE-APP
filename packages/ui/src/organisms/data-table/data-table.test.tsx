import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ColumnDef, DataTable, type DataTableLabels } from './data-table.js';

interface Team {
  id: string;
  name: string;
  points: number;
}

const teams: Team[] = [
  { id: 't1', name: 'Halcones', points: 9 },
  { id: 't2', name: 'Jaguares', points: 3 },
  { id: 't3', name: 'Ajolotes', points: 6 },
];

const columns: ColumnDef<Team>[] = [
  { accessorKey: 'name', header: 'Equipo' },
  { accessorKey: 'points', header: 'Puntos' },
];

const labels: DataTableLabels = {
  filterPlaceholder: 'Buscar',
  previousPage: 'Anterior',
  nextPage: 'Siguiente',
  pageInfo: (page, count) => `Página ${String(page)} de ${String(count)}`,
  selectAll: 'Seleccionar todo',
  selectRow: 'Seleccionar fila',
  selectedInfo: (count) => `${String(count)} seleccionados`,
  sortBy: (column) => `Ordenar por ${column}`,
};

const base = {
  columns,
  data: teams,
  labels,
  getRowId: (team: Team) => team.id,
  empty: 'Sin equipos',
};

afterEach(cleanup);

describe('DataTable', () => {
  it('sorts by a column header', async () => {
    const user = userEvent.setup();
    render(<DataTable {...base} />);

    await user.click(screen.getByRole('button', { name: 'Ordenar por Equipo' }));

    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['Ajolotes6', 'Halcones9', 'Jaguares3']);
    expect(screen.getByRole('columnheader', { name: /Equipo/ }).getAttribute('aria-sort')).toBe(
      'ascending',
    );
  });

  it('filters rows and shows the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    render(<DataTable {...base} filterable />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'jag');
    expect(screen.getAllByRole('row')).toHaveLength(2);

    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('Sin equipos')).toBeTruthy();
  });

  it('paginates', async () => {
    const user = userEvent.setup();
    render(<DataTable {...base} pageSize={2} />);

    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Página 2 de 2')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('passes the selected rows to bulk actions', async () => {
    const bulk = vi.fn((rows: Team[]) => <button type="button">Eliminar {rows.length}</button>);
    const user = userEvent.setup();
    render(<DataTable {...base} bulkActions={bulk} />);

    const [first, second] = screen.getAllByRole('checkbox', { name: 'Seleccionar fila' });
    if (!first || !second) throw new Error('missing rows');
    await user.click(first);
    await user.click(second);

    expect(screen.getByText('2 seleccionados')).toBeTruthy();
    expect(bulk).toHaveBeenLastCalledWith([teams[0], teams[1]]);
  });

  it('renders loading, error and empty states', () => {
    const { rerender } = render(<DataTable {...base} status="loading" />);
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');

    rerender(<DataTable {...base} status="error" error="No se pudo cargar" />);
    expect(screen.getByText('No se pudo cargar')).toBeTruthy();

    rerender(<DataTable {...base} data={[]} />);
    expect(screen.getByText('Sin equipos')).toBeTruthy();
  });
});
