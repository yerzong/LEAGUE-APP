import { Button, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { getNotificationTypes } from '@/features/notifications/api';
import { NotificationTypesTable } from '@/features/notifications/components/notification-types-table';
import { LoadError } from '@/features/shell/load-error';

const a = messages.notifications.admin;

export const metadata: Metadata = { title: a.title };

export default async function AdminNotificationsPage() {
  const types = await getNotificationTypes();
  if (!types.ok) return <LoadError code={types.code} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={a.title}
        description={a.description}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/notificaciones/entregas">{a.deliveriesTab}</Link>
          </Button>
        }
      />
      <NotificationTypesTable types={types.data} />
    </div>
  );
}
