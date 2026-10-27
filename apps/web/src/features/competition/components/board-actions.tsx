'use client';

import { format } from '@league/i18n';
import { Button, ConfirmDialog, toast } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { autoSchedule, generateFixtures } from '../actions';

const s = messages.competition.admin;

export function GenerateFixturesButton({
  tournamentId,
  enabled,
}: {
  tournamentId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-1">
      <ConfirmDialog
        trigger={<Button disabled={!enabled}>{s.generate}</Button>}
        title={s.generateTitle}
        description={s.generateDescription}
        confirmLabel={s.generate}
        cancelLabel={messages.common.cancel}
        onConfirm={async () => {
          const result = await generateFixtures(tournamentId);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(s.generated);
          router.refresh();
        }}
      />
      {!enabled && <span className="text-xs text-text-muted">{s.generateHint}</span>}
    </div>
  );
}

export function AutoScheduleButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        onClick={() => {
          void autoSchedule(tournamentId).then((result) => {
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(format(s.autoScheduled, { count: result.data.scheduled }));
            router.refresh();
          });
        }}
      >
        {s.autoSchedule}
      </Button>
      <span className="text-xs text-text-muted">{s.autoScheduleDescription}</span>
    </div>
  );
}
