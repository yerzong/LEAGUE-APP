'use client';

import type { TeamDetail } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GlassPanel,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import {
  cancelCaptaincyTransfer,
  requestCaptaincyTransfer,
  respondCaptaincyTransfer,
} from '../actions';

const t = messages.teams.transfer;

/** Banner for a pending transfer, and the form for the captain to propose one. */
export function TransferPanel({ team, viewerId }: { team: TeamDetail; viewerId: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const transfer = team.pendingTransfer;
  const nameOf = (userId: string) => {
    const member = team.members.find((m) => m.userId === userId);
    return member?.displayName ?? member?.username ?? '';
  };

  const done =
    (message: string) => async (promise: ReturnType<typeof respondCaptaincyTransfer>) => {
      const result = await promise;
      if (result.ok) {
        toast.success(message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    };

  if (transfer) {
    return (
      <GlassPanel className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          {transfer.toUserId === viewerId
            ? t.pendingForMe
            : format(t.pendingByMe, { name: nameOf(transfer.toUserId) })}
        </p>
        <div className="flex gap-2">
          {transfer.toUserId === viewerId && (
            <>
              <Button
                size="sm"
                onClick={() => void done(t.accepted)(respondCaptaincyTransfer(team.id, 'accept'))}
              >
                {t.accept}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void done(t.closed)(respondCaptaincyTransfer(team.id, 'decline'))}
              >
                {t.decline}
              </Button>
            </>
          )}
          {transfer.fromUserId === viewerId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void done(t.closed)(cancelCaptaincyTransfer(team.id))}
            >
              {t.cancel}
            </Button>
          )}
        </div>
      </GlassPanel>
    );
  }

  if (!team.permissions.includes('team:transfer_captaincy')) return null;
  const candidates = team.members
    .filter((m) => m.userId !== viewerId)
    .map((m) => ({ value: m.userId, label: m.displayName ?? m.username ?? '' }));
  if (candidates.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <SelectField
            label={t.target}
            value={target}
            onChange={setTarget}
            options={candidates}
            placeholder={messages.profile.fields.choose}
          />
        </div>
        <Button
          variant="secondary"
          disabled={!target}
          onClick={() => {
            if (target) void done(t.requested)(requestCaptaincyTransfer(team.id, target));
          }}
        >
          {t.request}
        </Button>
      </CardContent>
    </Card>
  );
}
