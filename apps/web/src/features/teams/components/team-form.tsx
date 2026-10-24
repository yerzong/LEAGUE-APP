'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTeamRequestSchema,
  type CreateTeamInput,
  type CreateTeamRequest,
  type TeamDetail,
} from '@league/contracts';
import { Button, Field, FormField, Textarea, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { regionOptions } from '@/features/forms/options';
import { SelectField } from '@/features/forms/select-field';
import { fieldErrorMessage } from '@/lib/ui/forms';

import { createTeam, updateTeam } from '../actions';

const t = messages.teams;

/** Create a team, or edit one when `team` is given. */
export function TeamForm({ team, onSaved }: { team?: TeamDetail; onSaved?: () => void }) {
  const router = useRouter();
  const form = useForm<CreateTeamInput, unknown, CreateTeamRequest>({
    resolver: zodResolver(CreateTeamRequestSchema),
    defaultValues: {
      name: team?.name ?? '',
      tag: team?.tag ?? '',
      region: team?.region ?? 'la1',
      description: team?.description ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = team ? await updateTeam(team.id, values) : await createTeam(values);
    if (!result.ok) {
      if (result.code === 'team_name_taken')
        form.setError('name', { type: 'conflict', message: result.message });
      if (result.code === 'team_tag_taken')
        form.setError('tag', { type: 'conflict', message: result.message });
      toast.error(result.message);
      return;
    }
    toast.success(team ? messages.common.saved : t.created);
    onSaved?.();
    if (team) router.refresh();
    else router.push(`/app/equipos/${result.data.slug}`);
  });

  const conflictOr = (key: 'name' | 'tag') =>
    errors[key]?.type === 'conflict' ? errors[key].message : fieldErrorMessage(errors[key]);

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 md:grid-cols-2" noValidate>
      <FormField
        label={t.fields.name}
        error={conflictOr('name')}
        maxLength={32}
        {...form.register('name')}
      />
      <FormField
        label={t.fields.tag}
        hint={t.fields.tagHint}
        error={conflictOr('tag')}
        maxLength={5}
        {...form.register('tag')}
      />
      <Controller
        control={form.control}
        name="region"
        render={({ field }) => (
          <SelectField
            label={t.fields.region}
            value={field.value}
            onChange={(v) => {
              field.onChange(v ?? 'la1');
            }}
            options={regionOptions}
            placeholder={t.fields.region}
          />
        )}
      />
      <Field
        label={t.fields.description}
        hint={t.fields.descriptionHint}
        error={fieldErrorMessage(errors.description)}
        className="md:col-span-2"
      >
        {(control) => <Textarea {...control} maxLength={500} {...form.register('description')} />}
      </Field>
      <div className="md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {team ? messages.common.save : t.create}
        </Button>
      </div>
    </form>
  );
}
