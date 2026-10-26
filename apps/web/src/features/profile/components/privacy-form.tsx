'use client';

import {
  PRIVACY_FIELDS,
  type PrivacyField,
  type PrivacySettings,
  type PrivacyVisibility,
} from '@league/contracts';
import { Button, toast } from '@league/ui';
import { useState } from 'react';

import { messages } from '@/config/i18n';
import { visibilityOptions } from '@/features/forms/options';
import { SelectField } from '@/features/forms/select-field';

import { savePrivacy } from '../actions';

export function PrivacyForm({ initial }: { initial: Record<PrivacyField, PrivacyVisibility> }) {
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const result = await savePrivacy(settings satisfies PrivacySettings);
    setPending(false);
    if (result.ok) toast.success(messages.common.saved);
    else toast.error(result.message);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{messages.profile.privacy.description}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {PRIVACY_FIELDS.map((field) => (
          <SelectField
            key={field}
            label={messages.options.privacyFields[field]}
            value={settings[field]}
            onChange={(value) => {
              setSettings({ ...settings, [field]: value ?? 'private' });
            }}
            options={visibilityOptions}
            placeholder={messages.options.privacy.public}
          />
        ))}
      </div>
      <div>
        <Button onClick={() => void save()} disabled={pending}>
          {messages.common.save}
        </Button>
      </div>
    </div>
  );
}
