'use client';

// Wizard controls bound to the tournament config form (React Hook Form).
// Names are paths of TournamentConfigInput; errors come from its Zod schema.

import type { TournamentConfigInput } from '@league/contracts';
import { Checkbox, Field, FormField, Label, Switch, Textarea, cn } from '@league/ui';
import { type ReactNode, useId } from 'react';
import { Controller, get, useFormContext, type FieldPath } from 'react-hook-form';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import { fromZonedInput, toZonedInput } from '../format';

type Name = FieldPath<TournamentConfigInput>;

/** Field message from the config schema: custom codes have their own text when known. */
function useError(name: Name): string | undefined {
  const { formState } = useFormContext<TournamentConfigInput>();
  const error = get(formState.errors, name) as { message?: string; type?: string } | undefined;
  if (!error) return undefined;
  const custom: Readonly<Record<string, string>> = {
    starters_team_size: messages.tournaments.wizard.roster.startersHint,
    date_order: messages.forms.invalid,
  };
  return (error.message && custom[error.message]) ?? messages.forms.invalid;
}

export function TextInput({
  name,
  label,
  hint,
  maxLength,
  type = 'text',
  nullable = false,
  className,
}: {
  name: Name;
  label: string;
  hint?: string;
  maxLength?: number;
  type?: 'text' | 'time' | 'url';
  /** Empty becomes `null` (optional texts of the schema). */
  nullable?: boolean;
  className?: string;
}) {
  const { register } = useFormContext<TournamentConfigInput>();
  return (
    <FormField
      label={label}
      hint={hint}
      error={useError(name)}
      maxLength={maxLength}
      type={type}
      className={className}
      {...register(name, nullable ? { setValueAs: (v: unknown) => (v === '' ? null : v) } : {})}
    />
  );
}

export function TextArea({
  name,
  label,
  hint,
  maxLength,
  rows = 4,
  className,
}: {
  name: Name;
  label: string;
  hint?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
}) {
  const { register } = useFormContext<TournamentConfigInput>();
  return (
    <Field label={label} hint={hint} error={useError(name)} className={className}>
      {(control) => <Textarea {...control} rows={rows} maxLength={maxLength} {...register(name)} />}
    </Field>
  );
}

/** Integer input; empty becomes `null` when `nullable`. */
export function NumberInput({
  name,
  label,
  hint,
  min,
  max,
  nullable = false,
  scale = 1,
  className,
}: {
  name: Name;
  label: string;
  hint?: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  /** Shown divided by this (cents → pesos). */
  scale?: number;
  className?: string;
}) {
  const { control } = useFormContext<TournamentConfigInput>();
  const error = useError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField
          label={label}
          hint={hint}
          error={error}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          className={className}
          name={field.name}
          ref={field.ref}
          onBlur={field.onBlur}
          value={typeof field.value === 'number' ? String(field.value / scale) : ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              field.onChange(nullable ? null : 0);
              return;
            }
            field.onChange(Math.round(Number(raw) * scale));
          }}
        />
      )}
    />
  );
}

export function SelectInput({
  name,
  label,
  hint,
  options,
  noneLabel,
  numeric = false,
  className,
}: {
  name: Name;
  label: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
  noneLabel?: string;
  /** The stored value is a number (tier, team size, weekday). */
  numeric?: boolean;
  className?: string;
}) {
  const { control } = useFormContext<TournamentConfigInput>();
  const error = useError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={className}>
          <SelectField
            label={label}
            hint={hint}
            error={error}
            value={
              typeof field.value === 'string' || typeof field.value === 'number'
                ? String(field.value)
                : null
            }
            onChange={(value) => {
              field.onChange(value === null ? null : numeric ? Number(value) : value);
            }}
            options={options}
            placeholder={label}
            noneLabel={noneLabel}
          />
        </div>
      )}
    />
  );
}

export function SwitchInput({
  name,
  label,
  hint,
  onToggle,
}: {
  name: Name;
  label: string;
  hint?: string;
  onToggle?: (checked: boolean) => void;
}) {
  const { control } = useFormContext<TournamentConfigInput>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start gap-3">
          <Switch
            id={id}
            checked={field.value === true}
            onCheckedChange={(checked) => {
              field.onChange(checked);
              onToggle?.(checked);
            }}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={id}>{label}</Label>
            {hint && <p className="text-xs text-text-muted">{hint}</p>}
          </div>
        </div>
      )}
    />
  );
}

/** Multi-choice stored as an array of values, in the order of `options`. */
export function CheckboxGroup({
  name,
  label,
  options,
  className,
}: {
  name: Name;
  label: string;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  const { control } = useFormContext<TournamentConfigInput>();
  const error = useError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selected = new Set(Array.isArray(field.value) ? (field.value as string[]) : []);
        return (
          <fieldset className={cn('flex flex-col gap-2', className)}>
            <legend className="mb-2 text-sm font-semibold text-text">{label}</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {options.map((option) => (
                <Label key={option.value} className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={selected.has(option.value)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked === true) next.add(option.value);
                      else next.delete(option.value);
                      field.onChange(options.map((o) => o.value).filter((v) => next.has(v)));
                    }}
                  />
                  {option.label}
                </Label>
              ))}
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
          </fieldset>
        );
      }}
    />
  );
}

/** ISO instant edited as wall-clock time of the event time zone. */
export function DateTimeInput({
  name,
  label,
  timeZone,
  className,
}: {
  name: Name;
  label: string;
  timeZone: string;
  className?: string;
}) {
  const { control } = useFormContext<TournamentConfigInput>();
  const error = useError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField
          label={label}
          error={error}
          type="datetime-local"
          className={className}
          name={field.name}
          ref={field.ref}
          onBlur={field.onBlur}
          value={toZonedInput(typeof field.value === 'string' ? field.value : null, timeZone)}
          onChange={(event) => {
            field.onChange(fromZonedInput(event.target.value, timeZone));
          }}
        />
      )}
    />
  );
}

export function StepIntro({ children }: { children: string }) {
  return <p className="max-w-prose text-text-muted">{children}</p>;
}

export function Group({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-md border border-border p-4', className)}>
      {title && <h3 className="font-display text-lg font-bold text-text caps">{title}</h3>}
      {children}
    </section>
  );
}
