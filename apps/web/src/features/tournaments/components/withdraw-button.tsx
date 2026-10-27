'use client';

import { Button, ConfirmDialog, toast } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { withdrawRegistration } from '../actions';

const r = messages.tournaments.portal.register_page;

export function WithdrawButton({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="secondary" size="sm">
          {r.withdraw}
        </Button>
      }
      title={r.withdrawTitle}
      description={r.withdrawDescription}
      confirmLabel={r.withdraw}
      cancelLabel={messages.common.cancel}
      destructive
      onConfirm={async () => {
        const result = await withdrawRegistration(registrationId);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(r.withdrawn);
        router.refresh();
      }}
    />
  );
}
