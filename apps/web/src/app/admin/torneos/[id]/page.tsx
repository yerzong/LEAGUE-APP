import { Breadcrumbs, Button, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getAdminTournament, getAuditTrail, getRegistrations } from '@/features/tournaments/api';
import {
  TournamentStatusBadge,
  TournamentTypeBadge,
} from '@/features/tournaments/components/status-badges';
import {
  AuditPanel,
  CalendarPanel,
  NextDelivery,
  ParticipantsPanel,
  PhasesPanel,
  RegistrationsPanel,
  SettingsPanel,
  StandingsPlaceholder,
  SummaryPanel,
} from '@/features/tournaments/tracking/tracking-panels';
import { TrackingTabs } from '@/features/tournaments/tracking/tracking-tabs';
import { renderRouterLink } from '@/lib/ui/router-link';

const tr = messages.tournaments.tracking;
const TABS = [
  'summary',
  'registrations',
  'participants',
  'phases',
  'calendar',
  'matches',
  'standings',
  'settings',
  'audit',
] as const;

export const metadata: Metadata = { title: messages.tournaments.admin.listTitle };

export default async function TournamentTrackingPage({
  params,
  searchParams,
}: PageProps<'/admin/torneos/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [detail, registrations, audit] = await Promise.all([
    getAdminTournament(id),
    getRegistrations(id),
    getAuditTrail(id),
  ]);
  if (!detail.ok) {
    if (detail.code === 'tournament_not_found' || detail.code === 'validation_failed') notFound();
    return <LoadError code={detail.code} />;
  }
  if (!registrations.ok) return <LoadError code={registrations.code} />;
  const data = detail.data;
  const list = registrations.data;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const initial = TABS.find((tab) => tab === requested) ?? 'summary';

  const content: Record<(typeof TABS)[number], ReactNode> = {
    summary: <SummaryPanel detail={data} registrations={list} />,
    registrations: <RegistrationsPanel detail={data} registrations={list} />,
    participants: <ParticipantsPanel detail={data} registrations={list} />,
    phases: <PhasesPanel detail={data} />,
    calendar: <CalendarPanel detail={data} />,
    matches: <NextDelivery />,
    standings: <StandingsPlaceholder />,
    settings: <SettingsPanel detail={data} />,
    audit: audit.ok ? (
      <AuditPanel detail={data} entries={audit.data} />
    ) : (
      <LoadError code={audit.code} />
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[{ label: tr.backToList, href: '/admin/torneos' }, { label: data.name }]}
        renderLink={renderRouterLink}
      />
      <div className="flex flex-col gap-3">
        <span className="flex flex-wrap gap-2">
          <TournamentTypeBadge type={data.type} />
          <TournamentStatusBadge status={data.status} />
        </span>
        <PageHeader
          title={data.name}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={`/admin/torneos/${data.id}/editar`}>{tr.edit}</Link>
              </Button>
              {data.status !== 'draft' && data.visibility !== 'private' && (
                <Button asChild variant="ghost">
                  <Link href={`/torneos/${data.slug}`}>{tr.publicPage}</Link>
                </Button>
              )}
            </div>
          }
        />
      </div>
      <TrackingTabs
        initial={initial}
        tabs={TABS.map((tab) => ({ id: tab, label: tr.tabs[tab], content: content[tab] }))}
      />
    </div>
  );
}
