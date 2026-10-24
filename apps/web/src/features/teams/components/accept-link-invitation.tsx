'use client';

import type { ReceivedInvitation } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { acceptInvitation } from '../actions';

export function AcceptLinkInvitation({
  code,
  invitation,
}: {
  code: string;
  invitation: ReceivedInvitation;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true);
        void acceptInvitation({ code }).then((result) => {
          setPending(false);
          if (result.ok) {
            toast.success(format(messages.invitations.accepted, { team: invitation.team.name }));
            router.push(`/app/equipos/${result.data.slug}`);
          } else {
            toast.error(result.message);
          }
        });
      }}
    >
      {messages.invitations.accept}
    </Button>
  );
}
