'use client';

import {
  NOTIFICATION_CHANNELS,
  type AdminNotificationType,
  type NotificationChannel,
} from '@league/contracts';
import { Button, Checkbox, Label, Switch, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { messages } from '@/config/i18n';

import { saveNotificationRule } from '../actions';
import { AVAILABLE_CHANNELS } from '../labels';

const n = messages.notifications;
const a = n.admin;

export function RuleForm({ type }: { type: AdminNotificationType }) {
  const router = useRouter();
  const id = useId();
  const [enabled, setEnabled] = useState(type.enabled);
  const [channels, setChannels] = useState<NotificationChannel[]>(type.channels);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const result = await saveNotificationRule(type.key, { enabled, channels });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(a.ruleSaved);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Switch
          id={`${id}-enabled`}
          checked={enabled}
          disabled={type.critical}
          onCheckedChange={setEnabled}
        />
        <Label htmlFor={`${id}-enabled`}>{a.ruleEnabled}</Label>
      </div>
      {type.critical && <p className="text-sm text-warning">{a.criticalLocked}</p>}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-text">{a.channels}</legend>
        {NOTIFICATION_CHANNELS.map((channel) => {
          const inApp = channel === 'in_app';
          return (
            <div key={channel} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${channel}`}
                checked={inApp || channels.includes(channel)}
                disabled={inApp}
                onCheckedChange={(checked) => {
                  setChannels((current) =>
                    checked === true
                      ? [...new Set([...current, channel])]
                      : current.filter((c) => c !== channel),
                  );
                }}
              />
              <Label htmlFor={`${id}-${channel}`} className="font-normal">
                {n.channels[channel]}
                {!AVAILABLE_CHANNELS.includes(channel) && (
                  <span className="ml-2 text-xs text-text-muted">({a.unavailable})</span>
                )}
              </Label>
            </div>
          );
        })}
      </fieldset>
      <div>
        <Button onClick={() => void save()} disabled={pending}>
          {a.saveRule}
        </Button>
      </div>
    </div>
  );
}
