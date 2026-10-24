'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  GENDERS,
  UpdatePrivateDataRequestSchema,
  type PrivateDataResponse,
  type UpdatePrivateDataInput,
  type UpdatePrivateDataRequest,
} from '@league/contracts';
import { format } from '@league/i18n';
import { Button, FormField, toast } from '@league/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';
import { formatDate } from '@/lib/ui/dates';
import { fieldErrorMessage } from '@/lib/ui/forms';

import { savePrivateData } from '../actions';

const t = messages.profile.private;
const genderOptions = GENDERS.map((value) => ({ value, label: messages.options.genders[value] }));

export function PrivateDataForm({ initial }: { initial: PrivateDataResponse }) {
  const [current, setCurrent] = useState(initial);
  const form = useForm<UpdatePrivateDataInput, unknown, UpdatePrivateDataRequest>({
    resolver: zodResolver(UpdatePrivateDataRequestSchema),
    defaultValues: {
      legalFirstName: initial.legalFirstName ?? '',
      legalLastName: initial.legalLastName ?? '',
      phoneE164: initial.phoneE164 ?? '',
      institutionalEmail: initial.institutionalEmail ?? '',
      gender: initial.gender,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await savePrivateData(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCurrent(result.data);
    toast.success(messages.common.saved);
  });

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-2" noValidate>
      <p className="text-sm text-text-muted md:col-span-2">{t.description}</p>
      <FormField
        label={t.legalFirstName}
        autoComplete="given-name"
        error={fieldErrorMessage(errors.legalFirstName)}
        {...form.register('legalFirstName')}
      />
      <FormField
        label={t.legalLastName}
        autoComplete="family-name"
        error={fieldErrorMessage(errors.legalLastName)}
        {...form.register('legalLastName')}
      />
      <FormField
        label={t.phone}
        hint={t.phoneHint}
        type="tel"
        autoComplete="tel"
        error={fieldErrorMessage(errors.phoneE164)}
        {...form.register('phoneE164')}
      />
      <FormField
        label={t.institutionalEmail}
        type="email"
        autoComplete="email"
        error={fieldErrorMessage(errors.institutionalEmail)}
        {...form.register('institutionalEmail')}
      />
      <Controller
        control={form.control}
        name="gender"
        render={({ field }) => (
          <SelectField
            label={t.gender}
            hint={
              current.genderLocked && current.genderDeclaredAt
                ? format(t.genderLocked, { date: formatDate(current.genderDeclaredAt) })
                : t.genderHint
            }
            value={field.value}
            onChange={field.onChange}
            options={genderOptions}
            placeholder={messages.profile.fields.choose}
            noneLabel={current.genderLocked ? undefined : messages.common.none}
            disabled={current.genderLocked}
          />
        )}
      />
      <div className="md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {messages.common.save}
        </Button>
      </div>
    </form>
  );
}
