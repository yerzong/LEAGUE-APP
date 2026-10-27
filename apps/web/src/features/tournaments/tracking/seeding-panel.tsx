'use client';

import type { Registration, SeedingRequest } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, FormField, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import { seedRegistrations } from '../actions';
import { seedingOptions } from '../wizard/options';

const p = messages.tournaments.tracking.participants;

/** Seeding of the approved entrants: random, by average rank (packages/core) or manual. */
export function SeedingPanel({
  tournamentId,
  approved,
  defaultMethod,
}: {
  tournamentId: string;
  approved: Registration[];
  defaultMethod: SeedingRequest['method'];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<SeedingRequest['method']>(defaultMethod);
  const [seeds, setSeeds] = useState<Record<string, string>>(() =>
    Object.fromEntries(approved.map((r, i) => [r.id, String(r.seed ?? i + 1)])),
  );
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label={p.method}
        value={method}
        onChange={(value) => {
          if (value) setMethod(value);
        }}
        options={seedingOptions}
        placeholder={p.method}
      />
      {method === 'manual' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {approved.map((registration) => (
            <FormField
              key={registration.id}
              label={format(p.manualSeed, { name: registration.displayName })}
              type="number"
              min={1}
              max={approved.length}
              value={seeds[registration.id] ?? ''}
              onChange={(event) => {
                setSeeds((current) => ({ ...current, [registration.id]: event.target.value }));
              }}
            />
          ))}
        </div>
      )}
      <div>
        <Button
          type="button"
          disabled={saving || approved.length === 0}
          onClick={() => {
            setSaving(true);
            void seedRegistrations(tournamentId, {
              method,
              seeds:
                method === 'manual'
                  ? approved.map((r) => ({ entrantId: r.id, seed: Number(seeds[r.id]) }))
                  : [],
            }).then((result) => {
              setSaving(false);
              if (!result.ok) {
                toast.error(result.message);
                return;
              }
              toast.success(p.applied);
              router.refresh();
            });
          }}
        >
          {p.apply}
        </Button>
      </div>
    </div>
  );
}
