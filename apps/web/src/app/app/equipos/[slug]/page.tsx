import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { requireUser } from '@/features/auth/session';
import { LoadError } from '@/features/shell/load-error';
import { getTeamBySlug } from '@/features/teams/api';
import { DangerZone } from '@/features/teams/components/danger-zone';
import { InvitePanel } from '@/features/teams/components/invite-panel';
import { JoinRequestsPanel } from '@/features/teams/components/join-requests-panel';
import { RosterTable } from '@/features/teams/components/roster-table';
import { TeamEditDialog } from '@/features/teams/components/team-edit-dialog';
import { TeamLogo } from '@/features/teams/components/team-logo';
import { TransferPanel } from '@/features/teams/components/transfer-panel';
import { formatDate } from '@/lib/ui/dates';

export const metadata: Metadata = { title: messages.teams.title };

const t = messages.teams;

export default async function TeamPage({ params }: PageProps<'/app/equipos/[slug]'>) {
  const { slug } = await params;
  const user = await requireUser(`/app/equipos/${slug}`);
  const team = await getTeamBySlug(slug);
  if (!team.ok) {
    if (team.code === 'team_not_found') notFound();
    return <LoadError code={team.code} />;
  }
  const detail = team.data;
  const can = (permission: (typeof detail.permissions)[number]) =>
    detail.permissions.includes(permission);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={detail.tag}
        title={detail.name}
        description={detail.description ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className="focus-ring text-sm text-text-muted underline"
              href={`/equipos/${detail.slug}`}
            >
              /equipos/{detail.slug}
            </Link>
            {can('team:edit') && <TeamEditDialog team={detail} />}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="blue">{messages.options.gameRegions[detail.region]}</Badge>
        {detail.myRole && (
          <Badge variant="league">{messages.options.teamRoles[detail.myRole]}</Badge>
        )}
      </div>

      <TransferPanel team={detail} viewerId={user.id} />

      {can('team:edit') && (
        <Card>
          <CardContent>
            <TeamLogo team={detail} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.roster.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <RosterTable team={detail} viewerId={user.id} />
        </CardContent>
      </Card>

      {can('team:invite') && <InvitePanel team={detail} />}
      {can('team:manage_roster') && <JoinRequestsPanel team={detail} />}

      <Card>
        <CardHeader>
          <CardTitle>{t.history}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1 text-sm">
            {detail.nameHistory.map((entry) => (
              <li key={entry.changedAt}>
                <span className="font-display">{entry.name}</span>{' '}
                <span className="text-text-muted">[{entry.tag}]</span>{' '}
                <span className="tabular text-xs text-text-muted">
                  {formatDate(entry.changedAt)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <DangerZone team={detail} />
    </div>
  );
}
