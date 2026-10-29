'use client';

import type { NotificationTemplate, TemplatePreview } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Field,
  Input,
  Textarea,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import {
  previewNotificationTemplate,
  resetNotificationTemplate,
  saveNotificationTemplate,
} from '../actions';

const n = messages.notifications;
const a = n.admin;

/** Subject and body of one channel, with the variables and a live preview. */
export function TemplateEditor({
  template,
  variables,
}: {
  template: NotificationTemplate;
  variables: string[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject ?? '');
  const [body, setBody] = useState(template.body);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [pending, setPending] = useState(false);
  const email = template.channel === 'email';

  const runPreview = async () => {
    const result = await previewNotificationTemplate({
      typeKey: template.typeKey,
      channel: template.channel,
      subject,
      body,
    });
    if (result.ok) setPreview(result.data);
    else toast.error(result.message);
  };

  const save = async () => {
    setPending(true);
    const result = await saveNotificationTemplate(template.typeKey, template.channel, {
      subject,
      body,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(a.templateSaved);
    router.refresh();
  };

  const reset = async () => {
    const result = await resetNotificationTemplate(template.typeKey, template.channel);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const base = result.data.templates.find((t) => t.channel === template.channel);
    setSubject(base?.subject ?? '');
    setBody(base?.body ?? '');
    setPreview(null);
    toast.success(a.templateReset);
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-text">
            {format(a.templateTitle, { channel: n.channels[template.channel] })}
          </h3>
          <Badge variant={template.customized ? 'league' : 'outline'}>
            {template.customized ? format(a.version, { version: template.version }) : a.base}
          </Badge>
        </div>
        <p className="text-sm text-text-muted">{a.templateDescription}</p>
        <Field label={email ? a.emailSubject : a.subject}>
          {(control) => (
            <Input
              {...control}
              value={subject}
              maxLength={200}
              onChange={(e) => {
                setSubject(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={a.body}>
          {(control) => (
            <Textarea
              {...control}
              value={body}
              rows={email ? 6 : 3}
              maxLength={4000}
              onChange={(e) => {
                setBody(e.target.value);
              }}
            />
          )}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{a.variables}</span>
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <Button
                key={variable}
                type="button"
                variant="secondary"
                size="xs"
                className="normal-case"
                aria-label={format(a.insertVariable, { variable })}
                onClick={() => {
                  setBody((current) => `${current}{{${variable}}}`);
                }}
              >
                <code>{`{{${variable}}}`}</code>
              </Button>
            ))}
          </div>
        </div>
        {preview && (
          <section
            aria-label={a.preview}
            className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-4"
          >
            <span className="caps text-xs text-text-muted">
              {a.preview} · {a.previewHint}
            </span>
            <p className="font-semibold text-text">{preview.subject}</p>
            <p className="text-sm whitespace-pre-line text-text">{preview.body}</p>
            {preview.unknown.length > 0 && (
              <p className="text-sm text-warning">
                {format(a.unknownVariables, { variables: preview.unknown.join(', ') })}
              </p>
            )}
          </section>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void runPreview()}>
            {a.preview}
          </Button>
          <Button onClick={() => void save()} disabled={pending}>
            {a.saveTemplate}
          </Button>
          {template.customized && (
            <ConfirmDialog
              trigger={<Button variant="ghost">{a.reset}</Button>}
              title={a.resetTitle}
              description={a.resetDescription}
              confirmLabel={a.reset}
              cancelLabel={messages.common.cancel}
              onConfirm={reset}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
