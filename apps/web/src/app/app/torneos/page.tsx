import { format } from '@league/i18n';
import { Button, EmptyState, PageHeader } from '@league/ui';
import { TrophyIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { exploreTournaments, getMyRegistrations } from '@/features/tournaments/api';
import { RegistrationOptionView } from '@/features/tournaments/components/registration-option';
import { EntrantStatusBadge } from '@/features/tournaments/components/status-badges';
import { TournamentCard } from '@/features/tournaments/components/tournament-card';
import { formatDay } from '@/features/tournaments/format';

const t = messages.tournaments.portal;

export const metadata: Metadata = { title: t.title };

export default async function ExploreTournamentsPage() {
  const [explore, mine] = await Promise.all([exploreTournaments(), getMyRegistrations()]);
  if (!explore.ok) return <LoadError code={explore.code} />;
  const active = mine.ok
    ? mine.data.filter((r) => ['pending', 'approved', 'waitlisted'].includes(r.status))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.description} />
      {active.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="my-registrations">
          <h2 id="my-registrations" className="caps text-sm text-text-muted">
            {t.myRegistrations}
          </h2>
          <ul className="flex flex-col gap-2">
            {active.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/app/torneos/${r.tournament.slug}`}
                  className="focus-ring flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 hover:border-brand"
                >
                  <span className="text-text">
                    {r.tournament.name} · {r.displayName}
                  </span>
                  <EntrantStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {explore.data.length === 0 ? (
        <EmptyState
          icon={<TrophyIcon />}
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={
            <Button asChild variant="outline">
              <Link href="/app/equipos">{t.emptyAction}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {explore.data.map((tournament) => {
            const registered = tournament.options.some((o) => o.registration !== null);
            const open = tournament.status === 'registration_open';
            return (
              <li key={tournament.id}>
                <TournamentCard
                  tournament={tournament}
                  href={`/torneos/${tournament.slug}`}
                  timeZone="America/Mexico_City"
                  footer={
                    <div className="flex flex-col gap-4">
                      {tournament.options.map((option) => (
                        <RegistrationOptionView key={option.teamId ?? 'me'} option={option} />
                      ))}
                      <div className="flex flex-wrap gap-2">
                        {(open || registered) && (
                          <Button asChild size="sm">
                            <Link href={`/app/torneos/${tournament.slug}`}>
                              {registered ? t.viewRegistration : t.register}
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/torneos/${tournament.slug}`}>{t.details}</Link>
                        </Button>
                      </div>
                      {tournament.registrationClosesAt && open && (
                        <p className="text-xs text-text-muted">
                          {format(t.closesAt, {
                            date: formatDay(tournament.registrationClosesAt, 'America/Mexico_City'),
                          })}
                        </p>
                      )}
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
