import { Breadcrumbs, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getAdminTournament } from '@/features/tournaments/api';
import { TournamentStatusBadge } from '@/features/tournaments/components/status-badges';
import { isWizardStep } from '@/features/tournaments/wizard/steps';
import { TournamentWizard } from '@/features/tournaments/wizard/tournament-wizard';
import { renderRouterLink } from '@/lib/ui/router-link';

const w = messages.tournaments.wizard;

export const metadata: Metadata = { title: w.editTitle };

export default async function EditTournamentPage({
  params,
  searchParams,
}: PageProps<'/admin/torneos/[id]/editar'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = await getAdminTournament(id);
  if (!result.ok) {
    if (result.code === 'tournament_not_found' || result.code === 'validation_failed') notFound();
    return <LoadError code={result.code} />;
  }
  const detail = result.data;
  const step = Array.isArray(query.paso) ? query.paso[0] : query.paso;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.tournaments.tracking.backToList, href: '/admin/torneos' },
          { label: detail.name, href: `/admin/torneos/${detail.id}` },
          { label: w.editTitle },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader
        title={detail.name}
        eyebrow={w.editTitle}
        actions={<TournamentStatusBadge status={detail.status} />}
      />
      <TournamentWizard
        key={detail.id}
        detail={detail}
        initialConfig={detail.config}
        templateId={detail.templateId}
        initialStep={isWizardStep(step) ? step : detail.status === 'draft' ? 'basics' : 'review'}
      />
    </div>
  );
}
