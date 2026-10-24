'use client';

import { type ReactNode, useId, useState } from 'react';

import { Button } from '../../atoms/button/button.js';
import { Label } from '../../atoms/label/label.js';
import { Textarea } from '../../atoms/textarea/textarea.js';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../alert-dialog/alert-dialog.js';

export interface ConfirmDialogReason {
  label: string;
  hint?: string | undefined;
  placeholder?: string | undefined;
  /** Minimum length after trimming. Defaults to 10. */
  minLength?: number | undefined;
}

export interface ConfirmDialogProps {
  /** Element that opens the dialog (rendered with `asChild`). */
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** When set, a written reason is mandatory (sensitive actions are audited with it). */
  reason?: ConfirmDialogReason | undefined;
  destructive?: boolean | undefined;
  /** Called with the trimmed reason (or null). The dialog closes when it resolves. */
  onConfirm: (reason: string | null) => void | Promise<void>;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  reason,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const reasonId = useId();

  const minLength = reason?.minLength ?? 10;
  const trimmed = text.trim();
  const reasonMissing = reason !== undefined && trimmed.length < minLength;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setText('');
  };

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm(reason ? trimmed : null);
      changeOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={reasonId}>{reason.label}</Label>
            <Textarea
              id={reasonId}
              value={text}
              placeholder={reason.placeholder}
              aria-describedby={reason.hint ? `${reasonId}-hint` : undefined}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
            {reason.hint && (
              <p id={`${reasonId}-hint`} className="text-xs text-text-muted">
                {reason.hint}
              </p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            disabled={reasonMissing || pending}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
