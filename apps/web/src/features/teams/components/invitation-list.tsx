'use client';

import type { ReceivedInvitation } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { acceptInvitation, declineInvitation } from '../actions';

const t = messages.invitations;

export function InvitationList({ invitations }: { invitations: readonly ReceivedInvitation[] }) {
  const router = useRouter();
  if (invitations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Avatar size="sm" className="rounded-md">
                  {invitation.team.logoUrl && (
                    <AvatarImage src={invitation.team.logoUrl} alt="" className="rounded-md" />
                  )}
                  <AvatarFallback className="rounded-md">{invitation.team.tag}</AvatarFallback>
                </Avatar>
                {format(t.received, {
                  team: invitation.team.name,
                  role: messages.options.teamRoles[invitation.teamRole],
                })}
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void acceptInvitation({ invitationId: invitation.id }).then((result) => {
                      if (result.ok) {
                        toast.success(format(t.accepted, { team: result.data.name }));
                        router.push(`/app/equipos/${result.data.slug}`);
                      } else {
                        toast.error(result.message);
                      }
                    })
                  }
                >
                  {t.accept}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void declineInvitation(invitation.id).then((result) => {
                      if (result.ok) {
                        toast.success(t.declined);
                        router.refresh();
                      } else {
                        toast.error(result.message);
                      }
                    })
                  }
                >
                  {t.decline}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
