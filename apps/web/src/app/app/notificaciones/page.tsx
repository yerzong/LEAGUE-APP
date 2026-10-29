import { Button, EmptyState, PageHeader } from '@league/ui';
import { BellIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';

import { messages } from '@/config/i18n';
import { getInbox } from '@/features/notifications/api';
import { InboxList, MarkAllReadButton } from '@/features/notifications/components/inbox-list';
import { LoadError } from '@/features/shell/load-error';

const n = messages.notifications;

export const metadata: Metadata = { title: n.inbox.title };

const QuerySchema = z.object({
  before: z.uuid().optional().catch(undefined),
  unread: z.literal('1').optional().catch(undefined),
});

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = QuerySchema.parse(await searchParams);
  const unread = query.unread === '1';
  const result = await getInbox({ before: query.before, unread, limit: 30 });
  if (!result.ok) return <LoadError code={result.code} />;
  const { items, unreadCount, nextCursor } = result.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={n.inbox.title}
        description={n.inbox.description}
        actions={
          <div className="flex flex-wrap gap-2">
            {unreadCount > 0 && <MarkAllReadButton />}
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/ajustes/notificaciones">{n.bell.settings}</Link>
            </Button>
          </div>
        }
      />
      <nav aria-label={n.inbox.title} className="flex gap-2">
        <Button asChild size="sm" variant={unread ? 'ghost' : 'secondary'}>
          <Link href="/app/notificaciones" aria-current={unread ? undefined : 'page'}>
            {n.inbox.all}
          </Link>
        </Button>
        <Button asChild size="sm" variant={unread ? 'secondary' : 'ghost'}>
          <Link href="/app/notificaciones?unread=1" aria-current={unread ? 'page' : undefined}>
            {n.inbox.unreadOnly}
          </Link>
        </Button>
      </nav>
      {items.length === 0 ? (
        <EmptyState
          icon={<BellIcon />}
          title={n.bell.empty}
          description={n.bell.emptyDescription}
        />
      ) : (
        <InboxList items={items} />
      )}
      {nextCursor && (
        <div>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/app/notificaciones?before=${nextCursor}${unread ? '&unread=1' : ''}`}>
              {n.inbox.older}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
