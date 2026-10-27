'use client';

// Wizard steps 5–9: format, schedule, supervision (with broadcast),
// communication and prizes.

import { defaultPhase, type PhaseFormat, type TournamentConfigInput } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, Card, CardContent } from '@league/ui';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldPath,
} from 'react-hook-form';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import {
  CheckboxGroup,
  DateTimeInput,
  Group,
  NumberInput,
  SelectInput,
  StepIntro,
  SwitchInput,
  TextInput,
} from './fields';
import {
  awardOptions,
  channelOptions,
  costreamOptions,
  distributionOptions,
  draftOptions,
  formatOptions,
  prizeTypeOptions,
  seedingOptions,
  seriesOptions,
  supervisionOptions,
  tiebreakOptions,
  timezoneOptions,
  topicOptions,
  weekdayOptions,
} from './options';

type Name = FieldPath<TournamentConfigInput>;
type PhasePath = `format.phases.${number}`;

/** Typed path of a phase (template literals only take strings for the linter). */
const phasePath = (index: number) => `format.phases.${String(index)}` as PhasePath;

const w = messages.tournaments.wizard;
const ELIMINATION = new Set(['single_elimination', 'double_elimination']);
const TABLE = new Set(['round_robin', 'double_round_robin', 'groups', 'swiss']);

function PhaseCard({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const f = w.format;
  const { control, getValues, setValue } = useFormContext<TournamentConfigInput>();
  const base = phasePath(index);
  const phaseFormat = useWatch({ control, name: `${base}.format` });
  const last = index === count - 1;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-text-muted caps">
            {format(f.phaseLabel, { n: index + 1 })}
          </span>
          <span className="flex gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={f.moveUp}
              disabled={index === 0}
              onClick={() => {
                onMove(index - 1);
              }}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={f.moveDown}
              disabled={last}
              onClick={() => {
                onMove(index + 1);
              }}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={f.removePhase}
              disabled={count === 1}
              onClick={onRemove}
            >
              <Trash2Icon />
            </Button>
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput name={`${base}.name` as Name} label={f.phaseName} maxLength={60} />
          <Controller
            control={control}
            name={`${base}.format` as Name}
            render={({ field }) => (
              <SelectField
                label={f.format}
                value={field.value as PhaseFormat}
                onChange={(value) => {
                  if (!value) return;
                  // A new format brings its own defaults; the name and the cut stay.
                  const current = getValues(phasePath(index));
                  setValue(
                    phasePath(index),
                    { ...defaultPhase(value, current.name), advance: current.advance ?? null },
                    { shouldDirty: true, shouldValidate: true },
                  );
                }}
                options={formatOptions}
                placeholder={f.format}
              />
            )}
          />
          <SelectInput
            name={`${base}.seriesFormat` as Name}
            label={f.seriesFormat}
            options={seriesOptions}
          />
          {ELIMINATION.has(phaseFormat) && (
            <SelectInput
              name={`${base}.finalSeriesFormat` as Name}
              label={f.finalSeriesFormat}
              options={seriesOptions}
              noneLabel={messages.common.none}
            />
          )}
          <SelectInput
            name={`${base}.draftMode` as Name}
            label={f.draftMode}
            options={draftOptions}
          />
          {phaseFormat === 'groups' && (
            <NumberInput
              name={`${base}.groupCount` as Name}
              label={f.groupCount}
              min={1}
              max={16}
            />
          )}
          {(phaseFormat === 'round_robin' || phaseFormat === 'groups') && (
            <SelectInput
              name={`${base}.legs` as Name}
              label={f.legs}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
              ]}
              numeric
            />
          )}
          {phaseFormat === 'swiss' && (
            <NumberInput name={`${base}.rounds` as Name} label={f.rounds} min={1} max={15} />
          )}
          {!last && (
            <NumberInput
              name={`${base}.advance` as Name}
              label={phaseFormat === 'groups' ? f.advancePerGroup : f.advance}
              min={1}
              max={256}
              nullable
            />
          )}
        </div>
        {phaseFormat === 'single_elimination' && (
          <SwitchInput name={`${base}.thirdPlaceMatch` as Name} label={f.thirdPlace} />
        )}
        {phaseFormat === 'double_elimination' && (
          <SwitchInput name={`${base}.grandFinalReset` as Name} label={f.grandFinalReset} />
        )}
        {TABLE.has(phaseFormat) && (
          <>
            <fieldset className="grid gap-4 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold text-text">{f.points}</legend>
              <NumberInput name={`${base}.points.win` as Name} label={f.win} min={-10} max={10} />
              <NumberInput name={`${base}.points.loss` as Name} label={f.loss} min={-10} max={10} />
              <NumberInput name={`${base}.points.draw` as Name} label={f.draw} min={-10} max={10} />
            </fieldset>
            <CheckboxGroup
              name={`${base}.tiebreakers` as Name}
              label={f.tiebreakers}
              options={tiebreakOptions}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function FormatStep() {
  const f = w.format;
  const { control, getValues, setValue } = useFormContext<TournamentConfigInput>();
  const phases = useFieldArray({ control, name: 'format.phases' });

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-3">
        {phases.fields.map((phase, index) => (
          <li key={phase.id}>
            <PhaseCard
              index={index}
              count={phases.fields.length}
              onMove={(to) => {
                phases.move(index, to);
                // Only the last phase has no cut.
                const list = getValues('format.phases');
                list.forEach((p, i) => {
                  const last = i === list.length - 1;
                  if (last && p.advance !== null) setValue(`${phasePath(i)}.advance`, null);
                  if (!last && p.advance === null) setValue(`${phasePath(i)}.advance`, 2);
                });
              }}
              onRemove={() => {
                phases.remove(index);
                const list = getValues('format.phases');
                if (list.length > 0) setValue(`${phasePath(list.length - 1)}.advance`, null);
              }}
            />
          </li>
        ))}
      </ol>
      {phases.fields.length < 5 && (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const list = getValues('format.phases');
              if (list.length > 0) setValue(`${phasePath(list.length - 1)}.advance`, 4);
              phases.append(defaultPhase('single_elimination', 'Playoffs'));
            }}
          >
            <PlusIcon /> {f.addPhase}
          </Button>
        </div>
      )}
      <SelectInput name="format.seedingMethod" label={f.seeding} options={seedingOptions} />
    </div>
  );
}

export function ScheduleStep() {
  const s = w.schedule;
  const { control } = useFormContext<TournamentConfigInput>();
  const timeZone = useWatch({ control, name: 'basics.timezone' });
  const windows = useFieldArray({ control, name: 'schedule.windows' });
  const blackouts = useFieldArray({ control, name: 'schedule.blackouts' });

  return (
    <div className="flex flex-col gap-6">
      <Group>
        <SelectInput name="basics.timezone" label={s.timezone} options={timezoneOptions} />
        <div className="grid gap-4 md:grid-cols-2">
          <DateTimeInput
            name="schedule.registrationOpensAt"
            label={s.registrationOpensAt}
            timeZone={timeZone}
          />
          <DateTimeInput
            name="schedule.registrationClosesAt"
            label={s.registrationClosesAt}
            timeZone={timeZone}
          />
          <DateTimeInput name="schedule.startsAt" label={s.startsAt} timeZone={timeZone} />
          <DateTimeInput name="schedule.endsAt" label={s.endsAt} timeZone={timeZone} />
        </div>
      </Group>
      <Group title={s.windows}>
        <p className="text-sm text-text-muted">{s.windowsHint}</p>
        <ul className="flex flex-col gap-3">
          {windows.fields.map((field, index) => {
            const base = `schedule.windows.${String(index)}`;
            return (
              <li
                key={field.id}
                className="grid items-end gap-3 border-b border-border pb-3 md:grid-cols-6"
              >
                <SelectInput
                  name={`${base}.weekday` as Name}
                  label={s.weekday}
                  options={weekdayOptions}
                  numeric
                  className="md:col-span-2"
                />
                <TextInput name={`${base}.startTime` as Name} label={s.startTime} type="time" />
                <TextInput name={`${base}.endTime` as Name} label={s.endTime} type="time" />
                <NumberInput
                  name={`${base}.slotMinutes` as Name}
                  label={s.slotMinutes}
                  min={15}
                  max={600}
                />
                <div className="flex items-end gap-2">
                  <NumberInput
                    name={`${base}.parallelMatches` as Name}
                    label={s.parallel}
                    min={1}
                    max={64}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={s.remove}
                    onClick={() => {
                      windows.remove(index);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              windows.append({
                weekday: 6,
                startTime: '12:00',
                endTime: '22:00',
                slotMinutes: 60,
                parallelMatches: 2,
              });
            }}
          >
            <PlusIcon /> {s.addWindow}
          </Button>
        </div>
      </Group>
      <Group title={s.blackouts}>
        <ul className="flex flex-col gap-3">
          {blackouts.fields.map((field, index) => {
            const base = `schedule.blackouts.${String(index)}`;
            return (
              <li
                key={field.id}
                className="grid items-end gap-3 border-b border-border pb-3 md:grid-cols-3"
              >
                <DateTimeInput
                  name={`${base}.startsAt` as Name}
                  label={s.blackoutStart}
                  timeZone={timeZone}
                />
                <DateTimeInput
                  name={`${base}.endsAt` as Name}
                  label={s.blackoutEnd}
                  timeZone={timeZone}
                />
                <div className="flex items-end gap-2">
                  <TextInput
                    name={`${base}.reason` as Name}
                    label={s.blackoutReason}
                    maxLength={200}
                    nullable
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={s.remove}
                    onClick={() => {
                      blackouts.remove(index);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const start = new Date();
              start.setUTCHours(0, 0, 0, 0);
              const end = new Date(start.getTime() + 24 * 3600 * 1000);
              blackouts.append({
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
                reason: null,
              });
            }}
          >
            <PlusIcon /> {s.addBlackout}
          </Button>
        </div>
      </Group>
      <Group>
        <div className="grid gap-4 md:grid-cols-2">
          <NumberInput
            name="schedule.checkinOpensMinutes"
            label={s.checkinOpens}
            min={5}
            max={240}
          />
          <NumberInput
            name="schedule.checkinClosesMinutes"
            label={s.checkinCloses}
            min={0}
            max={120}
          />
        </div>
        <SwitchInput name="schedule.rescheduleWithinWindowsOnly" label={s.reschedule} />
      </Group>
    </div>
  );
}

export function SupervisionStep() {
  const s = w.supervision;
  return (
    <div className="flex flex-col gap-6">
      <SelectInput name="supervision.level" label={s.level} options={supervisionOptions} />
      <Group title={s.broadcastTitle}>
        <SwitchInput name="broadcast.featuredMatches" label={s.featured} />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            name="broadcast.costreamPolicy"
            label={s.costream}
            options={costreamOptions}
          />
          <NumberInput name="broadcast.costreamDelaySeconds" label={s.delay} min={0} max={3600} />
        </div>
      </Group>
    </div>
  );
}

export function CommunicationStep() {
  const c = w.communication;
  return (
    <div className="flex flex-col gap-6">
      <StepIntro>{c.intro}</StepIntro>
      <CheckboxGroup name="communication.channels" label={c.channels} options={channelOptions} />
      <CheckboxGroup name="communication.topics" label={c.topics} options={topicOptions} />
    </div>
  );
}

export function PrizesStep() {
  const p = w.prizes;
  const { control } = useFormContext<TournamentConfigInput>();
  const items = useFieldArray({ control, name: 'prizes.items' });
  const hasPrizes = useWatch({ control, name: 'prizes.hasPrizes' });

  return (
    <div className="flex flex-col gap-6">
      <SwitchInput name="prizes.hasPrizes" label={p.hasPrizes} />
      {!hasPrizes ? (
        <p className="text-sm text-text-muted">{p.none}</p>
      ) : (
        <>
          <TextInput
            name="prizes.poolSummary"
            label={p.poolSummary}
            hint={p.poolSummaryHint}
            maxLength={200}
            nullable
          />
          <ul className="flex flex-col gap-3">
            {items.fields.map((field, index) => {
              const base = `prizes.items.${String(index)}`;
              return (
                <li key={field.id}>
                  <Card>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <SelectInput
                        name={`${base}.awardType` as Name}
                        label={p.awardType}
                        options={awardOptions}
                      />
                      <NumberInput
                        name={`${base}.placementFrom` as Name}
                        label={p.placementFrom}
                        min={1}
                        nullable
                      />
                      <NumberInput
                        name={`${base}.placementTo` as Name}
                        label={p.placementTo}
                        min={1}
                        nullable
                      />
                      <TextInput
                        name={`${base}.label` as Name}
                        label={p.label}
                        maxLength={80}
                        nullable
                      />
                      <SelectInput
                        name={`${base}.prizeType` as Name}
                        label={p.prizeType}
                        options={prizeTypeOptions}
                      />
                      <NumberInput
                        name={`${base}.amount` as Name}
                        label={p.amount}
                        min={0}
                        scale={100}
                        nullable
                      />
                      <TextInput
                        name={`${base}.description` as Name}
                        label={p.description}
                        maxLength={500}
                        nullable
                        className="md:col-span-2"
                      />
                      <NumberInput
                        name={`${base}.quantity` as Name}
                        label={p.quantity}
                        min={1}
                        max={100}
                      />
                      <SelectInput
                        name={`${base}.distribution` as Name}
                        label={p.distribution}
                        options={distributionOptions}
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            items.remove(index);
                          }}
                        >
                          <Trash2Icon /> {p.remove}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                items.append({
                  awardType: 'placement',
                  placementFrom: items.fields.length + 1,
                  placementTo: items.fields.length + 1,
                  label: null,
                  prizeType: 'prestige',
                  description: null,
                  amount: null,
                  currency: 'MXN',
                  quantity: 1,
                  distribution: 'team',
                });
              }}
            >
              <PlusIcon /> {p.add}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
