'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  UpdateProfileRequestSchema,
  type ProfileResponse,
  type UpdateProfileInput,
  type UpdateProfileRequest,
} from '@league/contracts';
import { Button, Field, FormField, Textarea, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { ProfileAutofill } from '@/features/dev-tools/autofill';
import { regionOptions, roleOptions } from '@/features/forms/options';
import { SelectField } from '@/features/forms/select-field';
import { fieldErrorMessage } from '@/lib/ui/forms';

import { saveProfile } from '../actions';
import { countryOptions } from '../options';

const t = messages.profile.fields;

export function ProfileForm({ profile }: { profile: ProfileResponse }) {
  const router = useRouter();
  const form = useForm<UpdateProfileInput, unknown, UpdateProfileRequest>({
    resolver: zodResolver(UpdateProfileRequestSchema),
    defaultValues: {
      displayName: profile.displayName ?? '',
      username: profile.username ?? '',
      countryCode: profile.countryCode ?? '',
      ...(profile.gameRegion ? { gameRegion: profile.gameRegion } : {}),
      birthDate: profile.birthDate ?? '',
      primaryRole: profile.primaryRole,
      secondaryRole: profile.secondaryRole,
      bio: profile.bio ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await saveProfile(values);
    if (!result.ok) {
      if (result.code === 'username_taken')
        form.setError('username', { type: 'conflict', message: result.message });
      toast.error(result.message);
      return;
    }
    toast.success(messages.common.saved);
    router.refresh();
  });

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-2" noValidate>
      <FormField
        label={t.displayName}
        autoComplete="nickname"
        error={fieldErrorMessage(errors.displayName)}
        {...form.register('displayName')}
      />
      <FormField
        label={t.username}
        hint={t.usernameHint}
        autoComplete="username"
        error={
          errors.username?.type === 'conflict'
            ? errors.username.message
            : fieldErrorMessage(errors.username)
        }
        {...form.register('username')}
      />
      <Controller
        control={form.control}
        name="countryCode"
        render={({ field, fieldState }) => (
          <SelectField
            label={t.country}
            value={field.value || null}
            onChange={(value) => {
              field.onChange(value ?? '');
            }}
            options={countryOptions()}
            placeholder={t.choose}
            error={fieldErrorMessage(fieldState.error)}
          />
        )}
      />
      <Controller
        control={form.control}
        name="gameRegion"
        render={({ field, fieldState }) => (
          <SelectField
            label={t.gameRegion}
            value={field.value}
            onChange={(value) => {
              field.onChange(value ?? undefined);
            }}
            options={regionOptions}
            placeholder={t.choose}
            error={fieldErrorMessage(fieldState.error)}
          />
        )}
      />
      <FormField
        label={t.birthDate}
        hint={t.birthDateHint}
        type="date"
        error={fieldErrorMessage(errors.birthDate)}
        {...form.register('birthDate')}
      />
      <Controller
        control={form.control}
        name="primaryRole"
        render={({ field, fieldState }) => (
          <SelectField
            label={t.primaryRole}
            value={field.value}
            onChange={field.onChange}
            options={roleOptions}
            placeholder={t.choose}
            noneLabel={messages.common.none}
            error={fieldErrorMessage(fieldState.error)}
          />
        )}
      />
      <Controller
        control={form.control}
        name="secondaryRole"
        render={({ field, fieldState }) => (
          <SelectField
            label={t.secondaryRole}
            value={field.value}
            onChange={field.onChange}
            options={roleOptions}
            placeholder={t.choose}
            noneLabel={messages.common.none}
            error={fieldErrorMessage(fieldState.error)}
          />
        )}
      />
      <Field
        label={t.bio}
        hint={t.bioHint}
        error={fieldErrorMessage(errors.bio)}
        className="md:col-span-2"
      >
        {(control) => <Textarea {...control} maxLength={280} {...form.register('bio')} />}
      </Field>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {messages.common.save}
        </Button>
        {ProfileAutofill && (
          <ProfileAutofill
            onFill={(values) => {
              form.reset(values, { keepDefaultValues: true });
            }}
          />
        )}
      </div>
    </form>
  );
}
