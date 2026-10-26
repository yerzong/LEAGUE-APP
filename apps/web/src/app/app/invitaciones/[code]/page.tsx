import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getInvitationByCode } from '@/features/teams/api';
import { AcceptLinkInvitation } from '@/features/teams/components/accept-link-invitation';

export const metadata: Metadata = { title: messages.invitations.linkTitle };

export default async function LinkInvitationPage({
  params,
}: PageProps<'/app/invitaciones/[code]'>) {
  const { code } = await params;
  const invitation = await getInvitationByCode(code);
  if (!invitation.ok) return <LoadError code={invitation.code} />;
  const { team, teamRole } = invitation.data;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center text-center">
        <Avatar size="lg" className="size-20 rounded-md">
          {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" className="rounded-md" />}
          <AvatarFallback className="rounded-md">{team.tag}</AvatarFallback>
        </Avatar>
        <CardTitle>{messages.invitations.linkTitle}</CardTitle>
        <CardDescription>
          {format(messages.invitations.linkDescription, {
            team: team.name,
            role: messages.options.teamRoles[teamRole],
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <AcceptLinkInvitation code={code} invitation={invitation.data} />
      </CardContent>
    </Card>
  );
}
