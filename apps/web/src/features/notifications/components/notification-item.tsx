'use client';

import type { InboxItem } from '@league/contracts';
import { cn } from '@league/ui';
import Link from 'next/link';

import { messages } from '@/config/i18n';

import { timeAgo } from '../format';

const n = messages.notifications;

/** One notification: title, text and time; unread ones are marked. */
export function NotificationItem({
  item,
  onOpen,
  compact = false,
}: {
  item: InboxItem;
  onOpen: (item: InboxItem) => void;
  compact?: boolean;
}) {
  const unread = item.readAt === null;
  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          unread ? 'bg-brand' : 'bg-transparent',
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn('text-sm text-text', unread && 'font-semibold')}>
          {item.title}
          {unread && <span className="sr-only"> · {n.inbox.unreadBadge}</span>}
        </span>
        <span className={cn('text-sm text-text-muted', compact && 'line-clamp-2')}>
          {item.body}
        </span>
        <span className="text-xs text-text-muted">
          {n.categories[item.category]} · {timeAgo(item.createdAt)}
        </span>
      </span>
    </>
  );
  const className =
    'focus-ring flex w-full gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-2';
  return item.link ? (
    <Link
      href={item.link}
      className={className}
      onClick={() => {
        onOpen(item);
      }}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className={className}
      onClick={() => {
        onOpen(item);
      }}
    >
      {content}
    </button>
  );
}
