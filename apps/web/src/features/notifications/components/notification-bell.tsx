'use client';

import type { Inbox, InboxItem } from '@league/contracts';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { plural } from '@league/i18n';
import { Button, Popover, PopoverContent, PopoverTrigger, toast } from '@league/ui';
import { BellIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { locale, messages } from '@/config/i18n';
import { browserSupabase } from '@/lib/supabase/browser';

import { loadBell, markAllNotificationsRead, markNotificationRead } from '../actions';
import { NotificationItem } from './notification-item';

const b = messages.notifications.bell;
const MAX_BADGE = 99;

/**
 * The bell of the portal: unread count, the latest notifications and live
 * updates (Supabase Realtime on the user's own rows, RLS applies). Opening it
 * refreshes too, so it stays right where Realtime is not available.
 */
export function NotificationBell({ userId, initial }: { userId: string; initial: Inbox | null }) {
  const [inbox, setInbox] = useState<Inbox | null>(initial);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const result = await loadBell();
    if (result.ok) setInbox(result.data);
  }, []);

  useEffect(() => {
    const supabase = browserSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;
    let active = true;
    // A burst of notifications (one event, several rows) is one refresh.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 300);
    };
    // The inbox is private: the channel must join with the user's token (with
    // the anonymous one Realtime refuses the subscription), so wait for the
    // session first. INSERT only: a refused listener closes the whole channel.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          schedule,
        )
        .subscribe();
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  const unread = inbox?.unreadCount ?? 0;
  const label = unread > 0 ? `${b.label}, ${plural(b.unread, unread, locale)}` : b.label;

  const openItem = (item: InboxItem) => {
    setOpen(false);
    if (item.readAt) return;
    setInbox((current) =>
      current
        ? {
            ...current,
            unreadCount: Math.max(current.unreadCount - 1, 0),
            items: current.items.map((i) =>
              i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i,
            ),
          }
        : current,
    );
    void markNotificationRead(item.id);
  };

  const markAll = async () => {
    const result = await markAllNotificationsRead();
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await refresh();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refresh();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} className="relative">
          <BellIcon aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              data-testid="notification-count"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-xs leading-none font-bold text-primary-foreground tabular"
            >
              {unread > MAX_BADGE ? `${String(MAX_BADGE)}+` : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <h2 className="font-display text-base font-bold text-text">{b.label}</h2>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => void markAll()}>
              {b.markAll}
            </Button>
          )}
        </div>
        {inbox && inbox.items.length > 0 ? (
          <ul className="flex max-h-96 flex-col overflow-y-auto py-1" aria-label={b.label}>
            {inbox.items.map((item) => (
              <li key={item.id}>
                <NotificationItem item={item} onOpen={openItem} compact />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-1 px-3 py-6 text-center">
            <p className="text-sm font-semibold text-text">{b.empty}</p>
            <p className="text-xs text-text-muted">{b.emptyDescription}</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm">
          <Link
            href="/app/notificaciones"
            className="focus-ring rounded-sm text-brand hover:underline"
            onClick={() => {
              setOpen(false);
            }}
          >
            {b.viewAll}
          </Link>
          <Link
            href="/app/ajustes/notificaciones"
            className="focus-ring rounded-sm text-text-muted hover:text-text"
            onClick={() => {
              setOpen(false);
            }}
          >
            {b.settings}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
