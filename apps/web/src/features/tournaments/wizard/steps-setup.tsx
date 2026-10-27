'use client';

// Wizard steps 1–2 and 4: basics, participants, game mode and roster.

import type { TournamentConfigInput } from '@league/contracts';
import { format } from '@league/i18n';
import { Checkbox, Label } from '@league/ui';
import { useEffect, useId, type ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { messages } from '@/config/i18n';

import { Group, NumberInput, SelectInput, SwitchInput, TextArea, TextInput } from './fields';
import {
  entrantKindOptions,
  mapOptions,
  modalityOptions,
  pickTypeOptions,
  policyOptions,
  spectatorOptions,
  teamSizeOptions,
  teamSourceOptions,
  tierOptions,
  typeOptions,
  visibilityOptions,
} from './options';

const w = messages.tournaments.wizard;

export function BasicsStep({ cover }: { cover: ReactNode }) {
  const b = w.basics;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextInput name="basics.name" label={b.name} maxLength={80} className="md:col-span-2" />
      <SelectInput name="basics.type" label={b.type} options={typeOptions} />
      <SelectInput name="basics.tier" label={b.tier} options={tierOptions} numeric />
      <SelectInput name="basics.visibility" label={b.visibility} options={visibilityOptions} />
      <TextArea
        name="basics.description"
        label={b.description}
        hint={b.descriptionHint}
        maxLength={2000}
        rows={5}
        className="md:col-span-2"
      />
      <div className="md:col-span-2">{cover}</div>
    </div>
  );
}

export function ParticipantsStep() {
  const p = w.participants;
  const { control, setValue, getValues } = useFormContext<TournamentConfigInput>();
  const [entrantKind, modality, fee] = useWatch({
    control,
    name: ['participants.entrantKind', 'participants.modality', 'participants.fee'],
  });

  // 1v1 means a roster of one; leaving it back to teams restores a 5v5 roster.
  useEffect(() => {
    const solo = entrantKind === 'solo';
    if (solo && getValues('game.teamSize') !== 1) {
      setValue('game.teamSize', 1);
      setValue('roster.starters', 1);
      setValue('roster.maxSubstitutes', 0);
      setValue('roster.coachAllowed', false);
    }
  }, [entrantKind, getValues, setValue]);

  // A venue exists only on site or hybrid.
  useEffect(() => {
    const venue = getValues('participants.venue');
    if (modality === 'online' && venue !== null) setValue('participants.venue', null);
    if (modality !== 'online' && !venue)
      setValue('participants.venue', { name: '', address: null, city: '', mapUrl: null });
  }, [modality, getValues, setValue]);

  return (
    <div className="flex flex-col gap-6">
      <Group title={messages.tournaments.sections.participants}>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            name="participants.entrantKind"
            label={p.entrantKind}
            options={entrantKindOptions}
          />
          <SelectInput
            name="participants.teamSource"
            label={p.teamSource}
            hint={p.teamSourceHint}
            options={teamSourceOptions}
          />
          <SelectInput
            name="participants.participantPolicy"
            label={p.policy}
            options={policyOptions}
          />
          <NumberInput
            name="participants.maxRostersPerClub"
            label={p.maxRostersPerClub}
            min={1}
            max={10}
          />
        </div>
      </Group>
      <Group title={p.modality}>
        <SelectInput name="participants.modality" label={p.modality} options={modalityOptions} />
        {modality !== 'online' && (
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="participants.venue.name" label={p.venueName} maxLength={120} />
            <TextInput name="participants.venue.city" label={p.venueCity} maxLength={80} />
            <TextInput
              name="participants.venue.address"
              label={p.venueAddress}
              maxLength={200}
              nullable
            />
            <TextInput name="participants.venue.mapUrl" label={p.venueMap} type="url" nullable />
          </div>
        )}
      </Group>
      <Group title={messages.tournaments.sections.capacity}>
        <div className="grid gap-4 md:grid-cols-2">
          <NumberInput
            name="capacity.capacity"
            label={p.capacity}
            hint={p.capacityHint}
            min={2}
            max={512}
            nullable
          />
          <SwitchInput name="capacity.waitlistEnabled" label={p.waitlist} />
        </div>
      </Group>
      <Group title={p.fee}>
        <FeeToggle hasFee={fee !== null} />
        {fee !== null && (
          <NumberInput name="participants.fee.amount" label={p.feeAmount} min={1} scale={100} />
        )}
      </Group>
    </div>
  );
}

function FeeToggle({ hasFee }: { hasFee: boolean }) {
  const { setValue } = useFormContext<TournamentConfigInput>();
  const p = w.participants;
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={hasFee}
        onCheckedChange={(checked) => {
          setValue(
            'participants.fee',
            checked === true ? { amount: 10_000, currency: 'MXN' } : null,
            { shouldDirty: true },
          );
        }}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{p.fee}</Label>
        <p className="text-xs text-text-muted">{p.feeHint}</p>
      </div>
    </div>
  );
}

export function GameStep() {
  const g = w.game;
  const { control, setValue } = useFormContext<TournamentConfigInput>();
  const teamSize = useWatch({ control, name: 'game.teamSize' });

  // The lobby size is the number of starters (validated by the schema too).
  useEffect(() => {
    if (typeof teamSize === 'number') setValue('roster.starters', teamSize);
  }, [teamSize, setValue]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SelectInput
        name="game.teamSize"
        label={g.teamSize}
        options={teamSizeOptions.map((o) => ({
          ...o,
          label: format(g.teamSizeOption, { size: o.value }),
        }))}
        numeric
      />
      <SelectInput name="game.map" label={g.map} options={mapOptions} />
      <SelectInput name="game.pickType" label={g.pickType} options={pickTypeOptions} />
      <SelectInput name="game.spectatorType" label={g.spectators} options={spectatorOptions} />
      <TextInput
        name="game.customWinCondition"
        label={g.winCondition}
        hint={g.winConditionHint}
        maxLength={200}
        nullable
        className="md:col-span-2"
      />
    </div>
  );
}

export function RosterStep() {
  const r = w.roster;
  const { control } = useFormContext<TournamentConfigInput>();
  const starters = useWatch({ control, name: 'roster.starters' });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text">{r.starters}</span>
        <span className="font-display text-2xl text-text tabular">{String(starters)}</span>
        <span className="text-xs text-text-muted">{r.startersHint}</span>
      </div>
      <NumberInput name="roster.maxSubstitutes" label={r.maxSubstitutes} min={0} max={5} />
      <SwitchInput name="roster.coachAllowed" label={r.coachAllowed} />
      <NumberInput
        name="roster.maxRosterChanges"
        label={r.maxRosterChanges}
        hint={r.maxRosterChangesHint}
        min={0}
        max={20}
        nullable
      />
      <NumberInput name="roster.minGamesForPlayoffs" label={r.minGames} min={0} max={50} nullable />
      <NumberInput name="roster.leaveCooldownDays" label={r.cooldown} min={0} max={90} />
    </div>
  );
}
