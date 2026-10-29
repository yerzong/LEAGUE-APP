'use client';

import type { InboxItem } from '@league/contracts';
import { Button, toast } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { markAllNotificationsRead, markNotificationRead } from '../actions';
import { NotificationItem } from './notification-item';

const n = messages.notifications;

export function InboxList({ items }: { items: InboxItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationItem
            item={item}
            onOpen={(opened) => {
              if (!opened.readAt) void markNotificationRead(opened.id);
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const markAll = async () => {
    const result = await markAllNotificationsRead();
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(n.inbox.markedAll);
    router.refresh();
  };
  return (
    <Button variant="secondary" size="sm" onClick={() => void markAll()}>
      {n.bell.markAll}
    </Button>
  );
}
