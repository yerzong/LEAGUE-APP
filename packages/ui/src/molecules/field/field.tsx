import { type ReactNode, useId } from 'react';

import { Label } from '../../atoms/label/label.js';
import { cn } from '../../lib/cn.js';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
  /** Receives the id and aria attributes to spread on the control (Select trigger, Textarea…). */
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, hint and error for any control; FormField is the Input shortcut. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ');
  const control: FieldControlProps = {
    id,
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };

  return (
    <div className={cn('flex flex-col gap-2 text-left', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(control)}
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
