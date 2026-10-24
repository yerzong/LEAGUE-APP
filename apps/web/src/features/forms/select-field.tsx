'use client';

import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@league/ui';

/** Radix Select cannot hold an empty value; this stands for "none". */
const NONE = '__none__';

export interface SelectFieldProps<V extends string> {
  label: string;
  /** `undefined` while a required value has not been chosen yet. */
  value: V | null | undefined;
  onChange: (value: V | null) => void;
  options: readonly { value: V; label: string }[];
  placeholder: string;
  /** Adds an option that clears the value. */
  noneLabel?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
}

export function SelectField<V extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  hint,
  error,
  disabled,
}: SelectFieldProps<V>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <Select
          value={value ?? (noneLabel ? NONE : '')}
          onValueChange={(next) => {
            onChange(next === NONE ? null : (next as V));
          }}
          disabled={disabled}
        >
          <SelectTrigger {...control} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
