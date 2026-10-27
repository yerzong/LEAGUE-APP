'use client';

import type { TournamentConfig } from '@league/contracts';
import { Button, FormField, toast } from '@league/ui';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { createTemplate } from '../actions';

const r = messages.tournaments.wizard.review;

/** "Guardar como plantilla": the whole configuration under a name. */
export function SaveTemplate({ config }: { config: TournamentConfig }) {
  const [name, setName] = useState(config.basics.name);
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField
        label={r.templateName}
        value={name}
        maxLength={80}
        className="min-w-64"
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={saving || name.trim().length < 3}
        onClick={() => {
          setSaving(true);
          void createTemplate(name.trim(), config).then((result) => {
            setSaving(false);
            if (result.ok) toast.success(r.templateSaved);
            else toast.error(result.message);
          });
        }}
      >
        {r.saveAsTemplate}
      </Button>
    </div>
  );
}
