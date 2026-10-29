import { DeliveryQuerySchema } from '@league/contracts';
import { Badge, Button, Card, CardContent, PageHeader } from '@league/ui';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { locale, messages } from '@/config/i18n';
import { getDeliveries } from '@/features/notifications/api';
import {
  DeliveriesTable,
  DeliveryFilters,
} from '@/features/notifications/components/deliveries-table';
import { LoadError } from '@/features/shell/load-error';

const n = messages.notifications;
const a = n.admin;

export const metadata: Metadata = { title: a.monitorTitle };

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = DeliveryQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : {};
  const result = await getDeliveries(query);
  if (!result.ok) return <LoadError code={result.code} />;
  const { items, counts, outbox, nextCursor } = result.data;
  const older = new URLSearchParams({
    ...(query.status && { status: query.status }),
    ...(query.channel && { channel: query.channel }),
    ...(nextCursor && { before: nextCursor }),
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/notificaciones"
        className="focus-ring flex w-fit items-center gap-1 rounded-sm text-sm text-text-muted hover:text-text"
      >
        <ArrowLeftIcon aria-hidden className="size-4" /> {a.back}
      </Link>
      <PageHeader title={a.monitorTitle} description={a.monitorDescription} />
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(['queued', 'sent', 'delivered', 'failed'] as const).map((status) => (
          <Card key={status}>
            <CardContent className="flex flex-col gap-1">
              <dt className="text-xs text-text-muted">
                {n.statuses[status]} · {a.last7Days}
              </dt>
              <dd className="font-display text-2xl font-bold text-text tabular">
                {new Intl.NumberFormat(locale).format(counts[status])}
              </dd>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">{a.outboxPending}</dt>
            <dd className="font-display text-2xl font-bold text-text tabular">{outbox.pending}</dd>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <dt className="text-xs text-text-muted">{a.outboxDead}</dt>
            <dd className="flex items-center gap-2 font-display text-2xl font-bold text-text tabular">
              {outbox.dead}
              {outbox.dead > 0 && <Badge variant="danger">{n.statuses.failed}</Badge>}
            </dd>
          </CardContent>
        </Card>
      </dl>
      <DeliveryFilters status={query.status} channel={query.channel} />
      <DeliveriesTable items={items} />
      {nextCursor && (
        <div>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/notificaciones/entregas?${older.toString()}`}>{a.older}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
