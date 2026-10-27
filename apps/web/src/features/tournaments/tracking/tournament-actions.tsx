'use client';

import type { TournamentAction, TournamentDetail } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, ConfirmDialog, toast } from '@league/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { runTournamentAction } from '../actions';

const t = messages.tournaments;

/** Lifecycle actions available in the current status (packages/core tournamentLifecycle). */
export function TournamentActions({ detail }: { detail: TournamentDetail }) {
  const router = useRouter();
  if (detail.actions.length === 0)
    return <p className="text-sm text-text-muted">{t.tracking.summary.noActions}</p>;

  const run = async (action: TournamentAction, reason: string | null) => {
    const result = await runTournamentAction(detail.id, action, reason);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(format(t.actionDone, { status: t.options.statuses[result.data.status] }));
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {detail.actions.map((action) =>
        action === 'publish' ? (
          <Button key={action} asChild>
            <Link href={`/admin/torneos/${detail.id}/editar?paso=review`}>{t.actions.publish}</Link>
          </Button>
        ) : (
          <ConfirmDialog
            key={action}
            trigger={
              <Button variant={action === 'cancel' ? 'secondary' : 'primary'}>
                {t.actions[action]}
              </Button>
            }
            title={t.actionConfirm[action].title}
            description={t.actionConfirm[action].description}
            confirmLabel={t.actions[action]}
            cancelLabel={messages.common.cancel}
            destructive={action === 'cancel'}
            reason={
              action === 'cancel'
                ? { label: t.reason.label, hint: t.reason.hint, placeholder: t.reason.placeholder }
                : undefined
            }
            onConfirm={(reason) => run(action, reason)}
          />
        ),
      )}
    </div>
  );
}
