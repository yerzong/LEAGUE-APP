import { Badge, Card, CardContent, PageHeader } from '@league/ui';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { getNotificationType } from '@/features/notifications/api';
import { RuleForm } from '@/features/notifications/components/rule-form';
import { TemplateEditor } from '@/features/notifications/components/template-editor';
import { typeLabel } from '@/features/notifications/labels';
import { LoadError } from '@/features/shell/load-error';

const n = messages.notifications;
const a = n.admin;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  return { title: typeLabel(decodeURIComponent((await params).key)) };
}

export default async function NotificationTypePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const key = decodeURIComponent((await params).key);
  const result = await getNotificationType(key);
  if (!result.ok) {
    if (result.status === 404 || result.status === 400) notFound();
    return <LoadError code={result.code} />;
  }
  const { type, templates, sampleVariables } = result.data;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/notificaciones"
        className="focus-ring flex w-fit items-center gap-1 rounded-sm text-sm text-text-muted hover:text-text"
      >
        <ArrowLeftIcon aria-hidden className="size-4" /> {a.back}
      </Link>
      <PageHeader
        title={typeLabel(type.key)}
        description={`${n.categories[type.category]} · ${n.audiences[type.audience]}`}
        actions={type.critical ? <Badge variant="warning">{a.critical}</Badge> : undefined}
      />
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold text-text">{a.ruleTitle}</h2>
          <p className="text-sm text-text-muted">{a.ruleDescription}</p>
          <RuleForm type={type} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <TemplateEditor
            key={`${template.channel}-${String(template.version)}-${String(template.customized)}`}
            template={template}
            variables={Object.keys(sampleVariables)}
          />
        ))}
      </div>
    </div>
  );
}
