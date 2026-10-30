'use client';

import { Button, Field, Input } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

const t = messages.stats.player;

/** Opens the head-to-head page against another player's username. */
export function HeadToHeadForm({ username }: { username: string }) {
  const router = useRouter();
  const [other, setOther] = useState('');
  const clean = other.trim().replace(/^@/, '').toLowerCase();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (clean) router.push(`/jugadores/${username}/vs/${encodeURIComponent(clean)}`);
      }}
    >
      <Field label={t.compareLabel} className="min-w-48 flex-1">
        {(control) => (
          <Input
            {...control}
            value={other}
            autoComplete="off"
            pattern="@?[A-Za-z0-9_]{3,20}"
            onChange={(event) => {
              setOther(event.target.value);
            }}
          />
        )}
      </Field>
      <Button type="submit" variant="secondary" disabled={!clean}>
        {t.compare}
      </Button>
    </form>
  );
}
