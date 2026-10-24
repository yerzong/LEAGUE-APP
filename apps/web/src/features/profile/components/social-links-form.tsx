'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  SOCIAL_PLATFORMS,
  UpdateSocialLinksRequestSchema,
  type UpdateSocialLinksRequest,
} from '@league/contracts';
import { Button, EmptyState, FormField, toast } from '@league/ui';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { visibilityOptions } from '@/features/forms/options';
import { SelectField } from '@/features/forms/select-field';
import { fieldErrorMessage } from '@/lib/ui/forms';

import { saveSocialLinks } from '../actions';

const t = messages.profile.social;

type LinkKey = 'platform' | 'url' | 'handle' | 'visibility';
/** Field array path for React Hook Form. */
const path = <K extends LinkKey>(index: number, key: K) =>
  `links.${index.toString()}.${key}` as `links.${number}.${K}`;
const platformOptions = SOCIAL_PLATFORMS.map((value) => ({
  value,
  label: messages.options.socialPlatforms[value],
}));

export function SocialLinksForm({ initial }: { initial: UpdateSocialLinksRequest }) {
  const form = useForm<UpdateSocialLinksRequest>({
    resolver: zodResolver(UpdateSocialLinksRequestSchema),
    defaultValues: { links: initial.links.map((l) => ({ ...l, handle: l.handle ?? '' })) },
  });
  const links = useFieldArray({ control: form.control, name: 'links' });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await saveSocialLinks(values);
    if (result.ok) toast.success(messages.common.saved);
    else toast.error(result.message);
  });

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-text-muted">{t.description}</p>
      {links.fields.length === 0 && <EmptyState title={t.empty} />}
      {links.fields.map((link, index) => (
        <fieldset
          key={link.id}
          className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-4"
        >
          <Controller
            control={form.control}
            name={path(index, 'platform')}
            render={({ field }) => (
              <SelectField
                label={t.platform}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v ?? 'other');
                }}
                options={platformOptions}
                placeholder={t.platform}
              />
            )}
          />
          <FormField
            label={t.url}
            type="url"
            inputMode="url"
            error={fieldErrorMessage(errors.links?.[index]?.url)}
            {...form.register(path(index, 'url'))}
          />
          <FormField
            label={t.handle}
            error={fieldErrorMessage(errors.links?.[index]?.handle)}
            {...form.register(path(index, 'handle'))}
          />
          <div className="flex items-end gap-2">
            <Controller
              control={form.control}
              name={path(index, 'visibility')}
              render={({ field }) => (
                <SelectField
                  label={t.visibility}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v ?? 'public');
                  }}
                  options={visibilityOptions}
                  placeholder={t.visibility}
                />
              )}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={messages.common.remove}
              onClick={() => {
                links.remove(index);
              }}
            >
              <Trash2Icon />
            </Button>
          </div>
        </fieldset>
      ))}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={links.fields.length >= 8}
          onClick={() => {
            links.append({ platform: 'twitch', url: '', handle: '', visibility: 'public' });
          }}
        >
          <PlusIcon />
          {t.add}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {messages.common.save}
        </Button>
      </div>
    </form>
  );
}
