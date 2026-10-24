'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  PLAYER_ROLES,
  UpdateFreeAgentRequestSchema,
  type FreeAgentResponse,
  type UpdateFreeAgentInput,
  type UpdateFreeAgentRequest,
} from '@league/contracts';
import { format } from '@league/i18n';
import { Button, Checkbox, Field, FormField, Label, Switch, Textarea, toast } from '@league/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { formatDate } from '@/lib/ui/dates';
import { fieldErrorMessage } from '@/lib/ui/forms';

import { saveFreeAgent } from '../actions';

const t = messages.freeAgent;

function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  return on ? [...new Set([...list, value])] : list.filter((item) => item !== value);
}

export function FreeAgentForm({ initial }: { initial: FreeAgentResponse }) {
  const [activeUntil, setActiveUntil] = useState(initial.active ? initial.activeUntil : null);
  const form = useForm<UpdateFreeAgentInput, unknown, UpdateFreeAgentRequest>({
    resolver: zodResolver(UpdateFreeAgentRequestSchema),
    defaultValues: {
      active: initial.active,
      roles: initial.roles,
      message: initial.message ?? '',
      availability: initial.availability,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const result = await saveFreeAgent(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setActiveUntil(result.data.active ? result.data.activeUntil : null);
    toast.success(t.saved);
  });

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-6" noValidate>
      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <div className="flex items-center gap-3">
            <Switch id="free-agent-active" checked={field.value} onCheckedChange={field.onChange} />
            <Label htmlFor="free-agent-active">{t.active}</Label>
          </div>
        )}
      />
      {activeUntil && (
        <p className="text-sm text-text-muted">
          {format(t.activeUntil, { date: formatDate(activeUntil) })}
        </p>
      )}

      <Controller
        control={form.control}
        name="roles"
        render={({ field, fieldState }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="caps text-xs text-text-muted">{t.roles}</legend>
            <div className="flex flex-wrap gap-4">
              {PLAYER_ROLES.map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Checkbox
                    id={`role-${role}`}
                    checked={field.value.includes(role)}
                    onCheckedChange={(checked) => {
                      field.onChange(toggle(field.value, role, checked === true));
                    }}
                  />
                  <Label htmlFor={`role-${role}`}>{messages.options.playerRoles[role]}</Label>
                </div>
              ))}
            </div>
            {fieldState.error && <p className="text-xs text-danger">{messages.forms.required}</p>}
          </fieldset>
        )}
      />

      <Controller
        control={form.control}
        name="availability.days"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-2">
            <legend className="caps text-xs text-text-muted">{t.days}</legend>
            <div className="flex flex-wrap gap-4">
              {messages.options.weekdays.map((name, day) => (
                <div key={name} className="flex items-center gap-2">
                  <Checkbox
                    id={`day-${String(day)}`}
                    checked={field.value.includes(day)}
                    onCheckedChange={(checked) => {
                      field.onChange(
                        toggle(field.value, day, checked === true).sort((a, b) => a - b),
                      );
                    }}
                  />
                  <Label htmlFor={`day-${String(day)}`}>{name}</Label>
                </div>
              ))}
            </div>
          </fieldset>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label={t.from}
          type="time"
          error={fieldErrorMessage(errors.availability?.from)}
          {...form.register('availability.from', { setValueAs: (v: string) => v || null })}
        />
        <FormField
          label={t.to}
          type="time"
          error={fieldErrorMessage(errors.availability?.to)}
          {...form.register('availability.to', { setValueAs: (v: string) => v || null })}
        />
      </div>

      <Field label={t.message} hint={t.messageHint} error={fieldErrorMessage(errors.message)}>
        {(control) => <Textarea {...control} maxLength={280} {...form.register('message')} />}
      </Field>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {messages.common.save}
        </Button>
      </div>
    </form>
  );
}
