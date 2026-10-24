import {
  Badge,
  Button,
  type ColumnDef,
  DataTable,
  type DataTableLabels,
  type DataTableStatus,
  EmptyState,
  ErrorState,
  Tabs,
  TabsList,
  TabsTrigger,
  toast,
} from '@league/ui';
import { format } from '@league/i18n';
import { UsersIcon } from 'lucide-react';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { circuitNames, type DemoTeam, demoTeams } from '../demo-data';

const t = messages.dataTable;

const labels: DataTableLabels = {
  filterPlaceholder: t.filterPlaceholder,
  previousPage: t.previousPage,
  nextPage: t.nextPage,
  pageInfo: (page, count) => format(t.pageInfo, { page, count }),
  selectAll: t.selectAll,
  selectRow: t.selectRow,
  selectedInfo: (count) => format(t.selectedInfo, { count }),
  sortBy: (column) => format(t.sortBy, { column }),
};

const columns: ColumnDef<DemoTeam>[] = [
  { accessorKey: 'name', header: 'Equipo' },
  { accessorKey: 'tag', header: 'Tag', enableSorting: false },
  {
    accessorKey: 'circuit',
    header: 'Circuito',
    cell: ({ row }) => (
      <Badge variant={row.original.circuit}>{circuitNames[row.original.circuit]}</Badge>
    ),
  },
  {
    accessorKey: 'wins',
    header: 'G',
    cell: ({ row }) => <span className="tabular">{row.original.wins}</span>,
  },
  {
    accessorKey: 'losses',
    header: 'P',
    cell: ({ row }) => <span className="tabular">{row.original.losses}</span>,
  },
];

type DemoState = DataTableStatus | 'empty';
const states: DemoState[] = ['ready', 'loading', 'error', 'empty'];

export function DataDemo() {
  const [state, setState] = useState<DemoState>('ready');

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={state}
        onValueChange={(value) => {
          setState(value as DemoState);
        }}
      >
        <TabsList variant="line" aria-label="Estado de la tabla">
          {states.map((value) => (
            <TabsTrigger key={value} value={value}>
              {value}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={state === 'empty' ? [] : demoTeams}
        labels={labels}
        getRowId={(team) => team.id}
        status={state === 'empty' ? 'ready' : state}
        filterable
        pageSize={5}
        bulkActions={(rows) => (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast(`${String(rows.length)} equipos dados de baja (demo)`)}
          >
            Dar de baja
          </Button>
        )}
        empty={
          <EmptyState
            icon={<UsersIcon />}
            title="Sin equipos"
            description="Ningún equipo coincide con la búsqueda."
          />
        }
        error={
          <ErrorState
            title="No se pudieron cargar los equipos"
            description="Revisa tu conexión."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setState('ready');
                }}
              >
                {messages.common.retry}
              </Button>
            }
          />
        }
      />
    </div>
  );
}
