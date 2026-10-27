import { DEFAULT_TOURNAMENT_CONFIG } from '@league/contracts';
import { format } from '@league/i18n';
import { Breadcrumbs, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import { z } from 'zod';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getTemplate } from '@/features/tournaments/api';
import { isWizardStep } from '@/features/tournaments/wizard/steps';
import { TournamentWizard } from '@/features/tournaments/wizard/tournament-wizard';
import { renderRouterLink } from '@/lib/ui/router-link';

const w = messages.tournaments.wizard;

export const metadata: Metadata = { title: w.newTitle };

export default async function NewTournamentPage({
  searchParams,
}: PageProps<'/admin/torneos/nuevo'>) {
  const params = await searchParams;
  const templateParam = Array.isArray(params.plantilla) ? params.plantilla[0] : params.plantilla;
  const templateId = z.uuid().safeParse(templateParam).success ? (templateParam ?? null) : null;
  const template = templateId ? await getTemplate(templateId) : null;
  if (template && !template.ok) return <LoadError code={template.code} />;
  const step = Array.isArray(params.paso) ? params.paso[0] : params.paso;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.tournaments.tracking.backToList, href: '/admin/torneos' },
          { label: w.newTitle },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader
        title={w.newTitle}
        description={
          template?.ok ? format(w.fromTemplate, { name: template.data.name }) : w.newDescription
        }
      />
      <TournamentWizard
        detail={null}
        initialConfig={template?.ok ? template.data.config : DEFAULT_TOURNAMENT_CONFIG}
        templateId={template?.ok ? template.data.id : null}
        initialStep={isWizardStep(step) ? step : 'basics'}
      />
    </div>
  );
}
