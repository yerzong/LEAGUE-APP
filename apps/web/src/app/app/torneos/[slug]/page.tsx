import { format } from '@league/i18n';
import { Breadcrumbs, Card, CardContent, EmptyState, PageHeader } from '@league/ui';
import { LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getRegistrationContext } from '@/features/tournaments/api';
import { RegistrationForm } from '@/features/tournaments/components/registration-form';
import {
  EntrantStatusBadge,
  TournamentStatusBadge,
  TournamentTypeBadge,
} from '@/features/tournaments/components/status-badges';
import { WithdrawButton } from '@/features/tournaments/components/withdraw-button';
import { formatDay } from '@/features/tournaments/format';
import { renderRouterLink } from '@/lib/ui/router-link';

const t = messages.tournaments;
const r = t.portal.register_page;

export const metadata: Metadata = { title: t.portal.title };

export default async function TournamentRegistrationPage({
  params,
}: PageProps<'/app/torneos/[slug]'>) {
  const { slug } = await params;
  const result = await getRegistrationContext(slug);
  if (!result.ok) {
    if (result.code === 'tournament_not_found' || result.code === 'validation_failed') notFound();
    return <LoadError code={result.code} />;
  }
  const context = result.data;
  const { tournament } = context;
  const open = tournament.status === 'registration_open';

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[{ label: r.back, href: '/app/torneos' }, { label: tournament.name }]}
        renderLink={renderRouterLink}
      />
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap gap-2">
          <TournamentTypeBadge type={tournament.type} />
          <TournamentStatusBadge status={tournament.status} />
        </span>
        <PageHeader
          title={tournament.name}
          description={
            tournament.startsAt
              ? format(t.portal.startsAt, {
                  date: formatDay(tournament.startsAt, tournament.timezone),
                })
              : undefined
          }
        />
      </div>

      {context.myRegistrations.length > 0 && (
        <section aria-labelledby="mine" className="flex flex-col gap-3">
          <h2 id="mine" className="caps text-sm text-text-muted">
            {t.portal.myRegistrations}
          </h2>
          {context.myRegistrations.map((registration) => (
            <Card key={registration.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-lg text-text">{registration.displayName}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                    <EntrantStatusBadge status={registration.status} />
                    {registration.paymentStatus === 'pending' && (
                      <span className="text-warning">{r.paymentPending}</span>
                    )}
                    {registration.waitlistPosition !== null && (
                      <span>
                        {format(r.waitlistPosition, { position: registration.waitlistPosition })}
                      </span>
                    )}
                  </span>
                  {registration.rejectionReason && (
                    <span className="text-sm text-text-muted">
                      {format(r.rejected, { reason: registration.rejectionReason })}
                    </span>
                  )}
                </div>
                {registration.canWithdraw && <WithdrawButton registrationId={registration.id} />}
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {open ? (
        <RegistrationForm context={context} />
      ) : (
        <EmptyState icon={<LockIcon />} title={r.closedTitle} description={r.closedDescription} />
      )}
    </div>
  );
}
