'use client';

import type {
  NotificationChannel,
  NotificationPreferences,
  PreferenceCategory,
} from '@league/contracts';
import { format } from '@league/i18n';
import { Button, Switch, toast } from '@league/ui';
import { InfoIcon, ShieldAlertIcon } from 'lucide-react';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { saveNotificationPreferences } from '../actions';

const n = messages.notifications;
const p = n.preferences;

/** Category × channel switches; in-app is locked on outside opt-in categories. */
export function PreferencesForm({ initial }: { initial: NotificationPreferences }) {
  const [categories, setCategories] = useState(initial.categories);
  const [pending, setPending] = useState(false);
  const channels = categories[0]?.channels.map((c) => c.channel) ?? [];

  const toggle = (category: PreferenceCategory['category'], channel: NotificationChannel) => {
    setCategories((current) =>
      current.map((row) =>
        row.category === category
          ? {
              ...row,
              channels: row.channels.map((c) =>
                c.channel === channel && !c.locked ? { ...c, enabled: !c.enabled } : c,
              ),
            }
          : row,
      ),
    );
  };

  const save = async () => {
    setPending(true);
    const result = await saveNotificationPreferences({
      items: categories.flatMap((row) =>
        row.channels
          .filter((c) => !c.locked)
          .map((c) => ({ category: row.category, channel: c.channel, enabled: c.enabled })),
      ),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCategories(result.data.categories);
    toast.success(p.saved);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                {messages.notifications.admin.category}
              </th>
              {channels.map((channel) => (
                <th key={channel} scope="col" className="px-4 py-3 text-center font-medium">
                  {n.channels[channel]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((row) => (
              <tr key={row.category} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-text">{n.categories[row.category]}</span>
                    {row.hasCritical && (
                      <span className="flex items-center gap-1 text-xs text-warning">
                        <ShieldAlertIcon aria-hidden className="size-3" /> {n.admin.critical}
                      </span>
                    )}
                    {row.optIn && <span className="text-xs text-text-muted">{p.optIn}</span>}
                  </span>
                </th>
                {row.channels.map((c) => (
                  <td key={c.channel} className="px-4 py-3 text-center">
                    <Switch
                      checked={c.enabled}
                      disabled={c.locked || pending}
                      title={c.locked ? p.locked : undefined}
                      aria-label={format(p.channelFor, {
                        channel: n.channels[c.channel],
                        category: n.categories[row.category],
                      })}
                      onCheckedChange={() => {
                        toggle(row.category, c.channel);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 text-xs text-text-muted">
        <li className="flex gap-2">
          <InfoIcon aria-hidden className="size-4 shrink-0" /> {p.locked}
        </li>
        <li className="flex gap-2">
          <ShieldAlertIcon aria-hidden className="size-4 shrink-0" /> {p.critical}
        </li>
        <li className="flex gap-2">
          <InfoIcon aria-hidden className="size-4 shrink-0" /> {p.soon}
        </li>
      </ul>
      <div>
        <Button onClick={() => void save()} disabled={pending}>
          {messages.common.save}
        </Button>
      </div>
    </div>
  );
}
