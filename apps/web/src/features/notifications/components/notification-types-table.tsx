'use client';

import type { AdminNotificationType } from '@league/contracts';
import { Badge, type ColumnDef, DataTable, EmptyState } from '@league/ui';
import { BellIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { dataTableLabels } from '@/lib/ui/data-table-labels';

import { AVAILABLE_CHANNELS, typeLabel } from '../labels';

const n = messages.notifications;
const a = n.admin;

const columns: ColumnDef<AdminNotificationType>[] = [
  {
    id: 'type',
    accessorFn: (row) => typeLabel(row.key),
    header: a.type,
    cell: ({ row }) => (
      <Link
        href={`/admin/notificaciones/${row.original.key}`}
        className="flex flex-col font-semibold text-text hover:text-brand"
      >
        {typeLabel(row.original.key)}
        <code className="text-xs font-normal text-text-muted">{row.original.key}</code>
      </Link>
    ),
  },
  {
    id: 'category',
    accessorFn: (row) => n.categories[row.category],
    header: a.category,
  },
  {
    id: 'audience',
    accessorFn: (row) => n.audiences[row.audience],
    header: a.audience,
  },
  {
    id: 'channels',
    header: a.channels,
    enableSorting: false,
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        {row.original.channels.map((channel) => (
          <Badge
            key={channel}
            variant={AVAILABLE_CHANNELS.includes(channel) ? 'secondary' : 'outline'}
            title={AVAILABLE_CHANNELS.includes(channel) ? undefined : a.unavailable}
          >
            {n.channels[channel]}
          </Badge>
        ))}
      </span>
    ),
  },
  {
    id: 'status',
    accessorFn: (row) => (row.enabled ? a.enabled : a.disabled),
    header: a.status,
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        <Badge variant={row.original.enabled ? 'success' : 'outline'}>
          {row.original.enabled ? a.enabled : a.disabled}
        </Badge>
        {row.original.critical && <Badge variant="warning">{a.critical}</Badge>}
        {row.original.customized.length > 0 && <Badge variant="league">{a.customized}</Badge>}
      </span>
    ),
  },
];

export function NotificationTypesTable({ types }: { types: AdminNotificationType[] }) {
  return (
    <DataTable
      columns={columns}
      data={types}
      labels={dataTableLabels}
      getRowId={(row) => row.key}
      filterable
      pageSize={25}
      empty={<EmptyState icon={<BellIcon />} title={a.title} description={a.description} />}
    />
  );
}
