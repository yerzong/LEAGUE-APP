'use client';

import {
  DELIVERY_STATUSES,
  NOTIFICATION_CHANNELS,
  type Delivery,
  type DeliveryStatus,
  type NotificationChannel,
} from '@league/contracts';
import { Badge, type ColumnDef, DataTable, EmptyState } from '@league/ui';
import { InboxIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';
import { dataTableLabels } from '@/lib/ui/data-table-labels';

import { formatStamp } from '../format';
import { typeLabel } from '../labels';

const n = messages.notifications;
const a = n.admin;

const STATUS_VARIANT: Readonly<Record<DeliveryStatus, 'warning' | 'blue' | 'success' | 'danger'>> =
  {
    queued: 'warning',
    sent: 'blue',
    delivered: 'success',
    failed: 'danger',
  };

const columns: ColumnDef<Delivery>[] = [
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: a.createdAt,
    cell: ({ row }) => <span className="tabular">{formatStamp(row.original.createdAt)}</span>,
  },
  {
    id: 'type',
    accessorFn: (row) => typeLabel(row.typeKey),
    header: a.type,
    cell: ({ row }) => (
      <span className="flex flex-col">
        {typeLabel(row.original.typeKey)}
        {row.original.subject && (
          <span className="line-clamp-1 text-xs text-text-muted">{row.original.subject}</span>
        )}
      </span>
    ),
  },
  {
    id: 'recipient',
    accessorFn: (row) => row.recipient.displayName ?? row.recipient.username ?? a.unknownRecipient,
    header: a.recipient,
  },
  {
    id: 'channel',
    accessorFn: (row) => n.channels[row.channel],
    header: a.channels,
  },
  {
    id: 'status',
    accessorFn: (row) => n.statuses[row.status],
    header: a.status,
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>{n.statuses[row.original.status]}</Badge>
    ),
  },
  { id: 'attempts', accessorKey: 'attempts', header: a.attempts },
  {
    id: 'lastError',
    accessorFn: (row) => row.lastError ?? '',
    header: a.lastError,
    cell: ({ row }) =>
      row.original.lastError ? (
        <code className="text-xs break-all text-danger">{row.original.lastError}</code>
      ) : null,
  },
];

const ALL = 'all';

export function DeliveryFilters({
  status,
  channel,
}: {
  status: DeliveryStatus | undefined;
  channel: NotificationChannel | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    next.delete('before');
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    router.push(next.size > 0 ? `${pathname}?${next.toString()}` : pathname);
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:max-w-xl">
      <SelectField
        label={a.filterStatus}
        value={status ?? ALL}
        onChange={(value) => {
          go('status', value);
        }}
        options={[
          { value: ALL, label: a.allStatuses },
          ...DELIVERY_STATUSES.map((s) => ({ value: s, label: n.statuses[s] })),
        ]}
        placeholder={a.allStatuses}
      />
      <SelectField
        label={a.filterChannel}
        value={channel ?? ALL}
        onChange={(value) => {
          go('channel', value);
        }}
        options={[
          { value: ALL, label: a.allChannels },
          ...NOTIFICATION_CHANNELS.map((c) => ({ value: c, label: n.channels[c] })),
        ]}
        placeholder={a.allChannels}
      />
    </div>
  );
}

export function DeliveriesTable({ items }: { items: Delivery[] }) {
  return (
    <DataTable
      columns={columns}
      data={items}
      labels={dataTableLabels}
      getRowId={(row) => row.id}
      pageSize={50}
      empty={
        <EmptyState
          icon={<InboxIcon />}
          title={a.noDeliveries}
          description={a.noDeliveriesDescription}
        />
      }
    />
  );
}
