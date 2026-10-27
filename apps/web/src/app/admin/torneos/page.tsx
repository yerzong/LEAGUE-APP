import { Button, EmptyState, PageHeader } from '@league/ui';
import { TrophyIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getAdminTournaments, getRegistrationCounts } from '@/features/tournaments/api';
import { AdminTournamentTable } from '@/features/tournaments/components/admin-tournament-table';

const a = messages.tournaments.admin;

export const metadata: Metadata = { title: a.listTitle };

export default async function AdminTournamentsPage() {
  const tournaments = await getAdminTournaments();
  if (!tournaments.ok) return <LoadError code={tournaments.code} />;
  const counts = await getRegistrationCounts(tournaments.data.map((t) => t.id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={a.listTitle}
        description={a.listDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/plantillas">{a.templates}</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/torneos/nuevo">{a.newTournament}</Link>
            </Button>
          </div>
        }
      />
      {tournaments.data.length === 0 ? (
        <EmptyState
          icon={<TrophyIcon />}
          title={a.emptyTitle}
          description={a.emptyDescription}
          action={
            <Button asChild>
              <Link href="/admin/torneos/nuevo">{a.newTournament}</Link>
            </Button>
          }
        />
      ) : (
        <AdminTournamentTable
          tournaments={tournaments.data}
          counts={counts.ok ? counts.data : {}}
        />
      )}
    </div>
  );
}
