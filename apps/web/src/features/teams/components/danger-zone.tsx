'use client';

import type { TeamDetail } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, ConfirmDialog, toast } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { dissolveTeam, leaveTeam } from '../actions';

const t = messages.teams;

/** Leave the team (non-captains) or dissolve it (captain, with an audited reason). */
export function DangerZone({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const canDissolve = team.permissions.includes('team:dissolve');

  return (
    <div className="flex flex-wrap gap-2">
      {team.myRole !== 'captain' && (
        <ConfirmDialog
          trigger={<Button variant="outline">{t.leave}</Button>}
          title={t.leaveTitle}
          description={t.leaveDescription}
          confirmLabel={t.leave}
          cancelLabel={messages.common.cancel}
          destructive
          onConfirm={async () => {
            const result = await leaveTeam(team.id);
            if (result.ok) {
              toast.success(t.left);
              router.push('/app/equipos');
            } else {
              toast.error(result.message);
            }
          }}
        />
      )}
      {canDissolve && (
        <ConfirmDialog
          trigger={<Button variant="destructive">{t.dissolve}</Button>}
          title={format(t.dissolveTitle, { name: team.name })}
          description={t.dissolveDescription}
          confirmLabel={t.dissolve}
          cancelLabel={messages.common.cancel}
          destructive
          reason={{ label: t.dissolveReason, hint: t.dissolveReasonHint, minLength: 10 }}
          onConfirm={async (reason) => {
            const result = await dissolveTeam(team.id, reason ?? '');
            if (result.ok) {
              toast.success(t.dissolved);
              router.push('/app/equipos');
            } else {
              toast.error(result.message);
            }
          }}
        />
      )}
    </div>
  );
}
