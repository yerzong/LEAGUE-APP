'use client';

import type { RegistrationCounts, TournamentSummary } from '@league/contracts';
import { format } from '@league/i18n';
import { type ColumnDef, DataTable, EmptyState } from '@league/ui';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { dataTableLabels } from '@/lib/ui/data-table-labels';

import { formatDay } from '../format';
import { TournamentStatusBadge, TournamentTypeBadge } from './status-badges';

const a = messages.tournaments.admin;

type Row = TournamentSummary & { approved: number; pending: number };

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'name',
    header: a.columns.name,
    cell: ({ row }) => (
      <Link
        href={`/admin/torneos/${row.original.id}`}
        className="font-semibold text-text hover:text-brand"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'type',
    header: a.columns.type,
    cell: ({ row }) => <TournamentTypeBadge type={row.original.type} />,
  },
  {
    accessorKey: 'status',
    header: a.columns.status,
    cell: ({ row }) => <TournamentStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'startsAt',
    header: a.columns.startsAt,
    cell: ({ row }) =>
      row.original.startsAt ? formatDay(row.original.startsAt, 'America/Mexico_City') : a.noDate,
  },
  {
    accessorKey: 'approved',
    header: a.columns.registrations,
    cell: ({ row }) => (
      <span className="tabular">
        {row.original.capacity === null
          ? format(a.registrationsUnlimited, { approved: row.original.approved })
          : format(a.registrationsOf, {
              approved: row.original.approved,
              capacity: row.original.capacity,
            })}
      </span>
    ),
  },
  {
    accessorKey: 'pending',
    header: a.columns.pending,
    cell: ({ row }) => <span className="tabular">{row.original.pending}</span>,
  },
];

export function AdminTournamentTable({
  tournaments,
  counts,
}: {
  tournaments: TournamentSummary[];
  counts: RegistrationCounts;
}) {
  const rows: Row[] = tournaments.map((t) => ({
    ...t,
    approved: counts[t.id]?.approved ?? 0,
    pending: counts[t.id]?.pending ?? 0,
  }));
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      labels={dataTableLabels}
      empty={<EmptyState title={a.emptyTitle} />}
      filterable
    />
  );
}
