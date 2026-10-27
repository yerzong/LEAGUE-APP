'use client';

import type { TournamentDetail } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, ConfirmDialog, Field, FormField, Textarea, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { publishRulebookVersion, saveRulebookDraft } from '../actions';
import { formatDay } from '../format';

const r = messages.tournaments.wizard.review;
const s = messages.tournaments.tracking.settings;

/**
 * Edits the rulebook draft. Before publishing the tournament the draft becomes
 * version 1 on publish; afterwards a new version is published from here.
 */
export function RulebookEditor({ detail }: { detail: TournamentDetail }) {
  const router = useRouter();
  const rulebook = detail.rulebook;
  const source = rulebook?.draft ?? rulebook?.current ?? null;
  const [title, setTitle] = useState(
    rulebook?.title ?? messages.tournaments.public.detail.rulebook,
  );
  const [content, setContent] = useState(source?.content ?? '');
  const [summary, setSummary] = useState(rulebook?.draft?.changeSummary ?? '');
  const [saving, setSaving] = useState(false);
  const published = detail.status !== 'draft';
  const draftVersion = rulebook?.draft?.version ?? (rulebook?.current?.version ?? 0) + 1;

  const save = async () => {
    setSaving(true);
    const result = await saveRulebookDraft(detail.id, {
      title,
      content,
      changeSummary: summary.trim() === '' ? null : summary,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success(r.rulebookSaved);
    router.refresh();
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{r.rulebookHint}</p>
      {published && (
        <p className="text-sm text-text">
          {rulebook?.current
            ? format(s.currentVersion, {
                version: rulebook.current.version,
                date: rulebook.current.publishedAt
                  ? formatDay(rulebook.current.publishedAt, detail.config.basics.timezone)
                  : '',
              })
            : s.noVersion}
        </p>
      )}
      <FormField
        label={r.rulebookTitle}
        value={title}
        maxLength={120}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <Field
        label={published ? format(s.draftVersion, { version: draftVersion }) : r.rulebookContent}
        hint={r.rulebookContentHint}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={12}
            value={content}
            maxLength={50000}
            onChange={(event) => {
              setContent(event.target.value);
            }}
          />
        )}
      </Field>
      {published && (
        <FormField
          label={s.changeSummary}
          value={summary}
          maxLength={500}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={saving || content.trim() === '' || title.trim().length < 3}
          onClick={() => void save()}
        >
          {r.rulebookSave}
        </Button>
        {published && (
          <ConfirmDialog
            trigger={
              <Button type="button" disabled={saving || content.trim() === ''}>
                {s.publishVersion}
              </Button>
            }
            title={s.publishVersion}
            description={r.rulebookHint}
            confirmLabel={s.publishVersion}
            cancelLabel={messages.common.cancel}
            onConfirm={async () => {
              if (!(await save())) return;
              const result = await publishRulebookVersion(detail.id);
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(s.versionPublished);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
