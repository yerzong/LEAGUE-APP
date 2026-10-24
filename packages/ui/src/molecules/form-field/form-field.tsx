import { type ComponentProps, useId } from 'react';

import { Input } from '../../atoms/input/input.js';
import { Label } from '../../atoms/label/label.js';
import { cn } from '../../lib/cn.js';

export interface FormFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

/** Labeled input with hint and error wired for screen readers. */
export function FormField({ label, error, hint, id, className, ...props }: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2 text-left', className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
