'use client';

import { plural } from '@league/i18n';
import { Button, ConfirmDialog, toast } from '@league/ui';
import { RefreshCwIcon } from 'lucide-react';

import { locale, messages } from '@/config/i18n';

import { recalculateTournamentStats } from '../../actions';

const t = messages.stats.admin.recalculate;

export function RecalculateStatsButton({ tournamentId }: { tournamentId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="secondary">
          <RefreshCwIcon />
          {t.action}
        </Button>
      }
      title={t.title}
      description={t.description}
      confirmLabel={t.action}
      cancelLabel={messages.common.cancel}
      onConfirm={async () => {
        const result = await recalculateTournamentStats(tournamentId);
        if (result.ok) toast.success(plural(t.done, result.data.matches, locale));
        else toast.error(result.message);
      }}
    />
  );
}
