import { Button, EmptyState, PageHeader } from '@league/ui';
import { PlusIcon, ShieldIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getMyTeams } from '@/features/teams/api';
import { TeamCard } from '@/features/teams/components/team-card';

export const metadata: Metadata = { title: messages.teams.title };

const t = messages.teams;

export default async function MyTeamsPage() {
  const teams = await getMyTeams();
  if (!teams.ok) return <LoadError code={teams.code} />;

  const create = (
    <Button asChild>
      <Link href="/app/equipos/nuevo">
        <PlusIcon />
        {t.create}
      </Link>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.description} actions={create} />
      {teams.data.length === 0 ? (
        <EmptyState
          icon={<ShieldIcon />}
          title={t.empty}
          description={t.emptyHint}
          action={create}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {teams.data.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              role={team.myRole}
              href={`/app/equipos/${team.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
