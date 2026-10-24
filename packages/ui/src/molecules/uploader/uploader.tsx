'use client';

import { ImageUpIcon } from 'lucide-react';
import { type ChangeEvent, useId, useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '../../atoms/avatar/avatar.js';
import { Button } from '../../atoms/button/button.js';
import { Spinner } from '../../atoms/spinner/spinner.js';
import { cn } from '../../lib/cn.js';

export interface UploaderProps {
  label: string;
  hint?: string | undefined;
  /** MIME types, e.g. `['image/png', 'image/jpeg']`. */
  accept: readonly string[];
  maxBytes: number;
  previewUrl: string | null;
  /** Shown when there is no preview (initials or tag). */
  fallback: string;
  shape?: 'circle' | 'square' | undefined;
  labels: { choose: string; tooLarge: string; invalidType: string; uploading?: string | undefined };
  /** Receives a file that passed the size and type checks. The server checks again. */
  onSelect: (file: File) => Promise<void>;
  disabled?: boolean | undefined;
}

/** Image picker with preview. Validates before uploading so the user gets instant feedback. */
export function Uploader({
  label,
  hint,
  accept,
  maxBytes,
  previewUrl,
  fallback,
  shape = 'circle',
  labels,
  onSelect,
  disabled = false,
}: UploaderProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const change = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!accept.includes(file.type)) {
      setError(labels.invalidType);
      return;
    }
    if (file.size > maxBytes) {
      setError(labels.tooLarge);
      return;
    }
    setError(null);
    setPending(true);
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    try {
      await onSelect(file);
    } finally {
      setPending(false);
      setLocalPreview(null);
      URL.revokeObjectURL(url);
    }
  };

  const shown = localPreview ?? previewUrl;
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-md';

  return (
    <div className="flex items-center gap-4">
      <Avatar size="lg" className={cn('size-20', rounded)}>
        {shown && <AvatarImage src={shown} alt="" className={rounded} />}
        <AvatarFallback className={cn('caps text-lg', rounded)}>{fallback}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="caps text-xs text-text-muted">
          {label}
        </label>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept.join(',')}
          className="sr-only"
          disabled={disabled || pending}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => void change(event)}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || pending}
          onClick={() => input.current?.click()}
        >
          {pending ? <Spinner label={labels.uploading ?? labels.choose} /> : <ImageUpIcon />}
          {labels.choose}
        </Button>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
