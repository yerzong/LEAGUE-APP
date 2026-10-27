import { format } from '@league/i18n';
import { Card, CardContent, EmptyState, PageHeader } from '@league/ui';
import { LayersIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getTemplates } from '@/features/tournaments/api';
import { TemplateActions } from '@/features/tournaments/components/template-actions';

const a = messages.tournaments.admin;
const o = messages.tournaments.options;

export const metadata: Metadata = { title: a.templatesTitle };

export default async function TemplatesPage() {
  const templates = await getTemplates();
  if (!templates.ok) return <LoadError code={templates.code} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={a.templatesTitle} description={a.templatesDescription} />
      {templates.data.length === 0 ? (
        <EmptyState
          icon={<LayersIcon />}
          title={a.templatesEmptyTitle}
          description={a.templatesEmptyDescription}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.data.map((template) => (
            <li key={template.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-display text-lg font-bold text-text">
                      {template.name}
                    </span>
                    <span className="text-sm text-text-muted">
                      {format(a.templateSummary, {
                        type: o.types[template.config.basics.type],
                        size: template.config.game.teamSize,
                        format: template.config.format.phases
                          .map((p) => o.formats[p.format])
                          .join(' → '),
                      })}
                    </span>
                  </div>
                  <TemplateActions id={template.id} name={template.name} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
