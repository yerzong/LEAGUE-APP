import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../atoms/badge/badge.js';
import { Button } from '../../atoms/button/button.js';
import { EmptyState } from '../empty-state/empty-state.js';
import { ErrorState } from '../error-state/error-state.js';
import { type ColumnDef, DataTable, type DataTableLabels } from './data-table.js';

interface Team {
  id: string;
  name: string;
  tag: string;
  circuit: 'league' | 'ascenso';
  points: number;
}

const names = [
  'Halcones',
  'Jaguares',
  'Ajolotes',
  'Coyotes',
  'Quetzales',
  'Lobos',
  'Águilas',
  'Tiburones',
];
const teams: Team[] = names.map((name, index) => ({
  id: `t${String(index)}`,
  name,
  tag: name.slice(0, 3).toUpperCase(),
  circuit: index % 2 === 0 ? 'league' : 'ascenso',
  points: (index * 7) % 13,
}));

const columns: ColumnDef<Team>[] = [
  { accessorKey: 'name', header: 'Equipo' },
  { accessorKey: 'tag', header: 'Tag', enableSorting: false },
  {
    accessorKey: 'circuit',
    header: 'Circuito',
    cell: ({ row }) => (
      <Badge variant={row.original.circuit}>
        {row.original.circuit === 'league' ? 'Liga' : 'Ascenso'}
      </Badge>
    ),
  },
  {
    accessorKey: 'points',
    header: 'Puntos',
    cell: ({ row }) => <span className="tabular">{row.original.points}</span>,
  },
];

const labels: DataTableLabels = {
  filterPlaceholder: 'Buscar equipo',
  previousPage: 'Anterior',
  nextPage: 'Siguiente',
  pageInfo: (page, count) => `Página ${String(page)} de ${String(count)}`,
  selectAll: 'Seleccionar todos',
  selectRow: 'Seleccionar equipo',
  selectedInfo: (count) => `${String(count)} seleccionados`,
  sortBy: (column) => `Ordenar por ${column}`,
};

const meta = {
  title: 'Organisms/DataTable',
  component: DataTable<Team>,
  args: {
    columns,
    data: teams,
    labels,
    getRowId: (team) => team.id,
    filterable: true,
    pageSize: 5,
    empty: <EmptyState title="Sin equipos" description="Ningún equipo coincide con la búsqueda." />,
    error: (
      <ErrorState
        title="No se pudieron cargar los equipos"
        action={
          <Button variant="secondary" size="sm">
            Reintentar
          </Button>
        }
      />
    ),
    bulkActions: (rows) => (
      <Button variant="destructive" size="sm">
        Dar de baja ({rows.length})
      </Button>
    ),
  },
} satisfies Meta<typeof DataTable<Team>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Loading: Story = { args: { status: 'loading' } };
export const Error: Story = { args: { status: 'error' } };
export const Empty: Story = { args: { data: [] } };
