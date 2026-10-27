'use client';

// Wizard step 3: the eligibility rule builder (docs/13 §5). Each rule is a
// Specification of packages/core; here the admin only picks types and values.

import {
  ELIGIBILITY_RULE_TYPES,
  type EligibilityRuleConfig,
  type EligibilityRuleType,
  type TournamentConfigInput,
} from '@league/contracts';
import { Button, Card, CardContent, Field, Input, Label, Switch } from '@league/ui';
import { Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldPath,
} from 'react-hook-form';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import { CheckboxGroup, DateTimeInput, NumberInput, SelectInput, StepIntro } from './fields';
import {
  divisionOptions,
  exclusivityOptions,
  genderOptions,
  rankTierOptions,
  regionOptions,
  tierOptions,
} from './options';

type Name = FieldPath<TournamentConfigInput>;

const w = messages.tournaments.wizard.eligibility;
const ruleLabels = messages.tournaments.rules;

const APEX = new Set(['master', 'grandmaster', 'challenger']);
const RANK_RULES = new Set(['rank_min', 'rank_max', 'peak_rank_max']);

/** A sensible starting value for each rule type. */
export function defaultRule(type: EligibilityRuleType): EligibilityRuleConfig {
  switch (type) {
    case 'riot_account_verified':
    case 'not_sanctioned':
    case 'legal_name_required':
      return { type };
    case 'region':
      return { type, params: { regions: ['la1'] } };
    case 'country':
      return { type, params: { countries: ['MX'] } };
    case 'rank_min':
      return { type, params: { rank: { tier: 'silver', division: 4 } } };
    case 'rank_max':
      return { type, params: { rank: { tier: 'diamond', division: 1 } } };
    case 'peak_rank_max':
      return { type, params: { rank: { tier: 'diamond', division: 1 }, windowDays: 90 } };
    case 'account_level_min':
      return { type, params: { level: 30 } };
    case 'account_age_min':
      return { type, params: { days: 60 } };
    case 'ranked_games_min':
      return { type, params: { games: 20 } };
    case 'age_min':
      return { type, params: { years: 16 } };
    case 'gender':
      return { type, params: { allowed: ['woman', 'non_binary'] } };
    case 'institution':
      return { type, params: { emailDomains: ['unam.mx'] } };
    case 'max_tier_roster':
      return { type, params: { tier: 1 } };
  }
}

/** Comma separated text ↔ list of strings. */
function ListInput({ name, label, upper = false }: { name: Name; label: string; upper?: boolean }) {
  const { control } = useFormContext<TournamentConfigInput>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} error={fieldState.error ? messages.forms.invalid : undefined}>
          {(controlProps) => (
            <Input
              {...controlProps}
              defaultValue={((field.value as string[] | undefined) ?? []).join(', ')}
              onBlur={(event) => {
                const values = event.target.value
                  .split(',')
                  .map((v) => (upper ? v.trim().toUpperCase() : v.trim().toLowerCase()))
                  .filter(Boolean);
                field.onChange(values);
                field.onBlur();
              }}
            />
          )}
        </Field>
      )}
    />
  );
}

function RankInput({ name }: { name: string }) {
  const { control, setValue } = useFormContext<TournamentConfigInput>();
  const tier = useWatch({ control, name: `${name}.tier` as Name }) as unknown;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Controller
        control={control}
        name={`${name}.tier` as Name}
        render={({ field }) => (
          <SelectField
            label={w.tier}
            value={field.value as string}
            onChange={(value) => {
              const next = value ?? 'gold';
              field.onChange(next);
              setValue(`${name}.division` as Name, APEX.has(next) ? undefined : 4, {
                shouldDirty: true,
              });
            }}
            options={rankTierOptions}
            placeholder={w.tier}
          />
        )}
      />
      {!(typeof tier === 'string' && APEX.has(tier)) && (
        <SelectInput
          name={`${name}.division` as Name}
          label={w.division}
          options={divisionOptions}
          numeric
        />
      )}
    </div>
  );
}

function TeamAverageSwitch({ name }: { name: string }) {
  const { control } = useFormContext<TournamentConfigInput>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={`${name}.appliesTo` as Name}
      render={({ field }) => (
        <div className="flex items-center gap-3">
          <Switch
            id={id}
            checked={field.value === 'team_average'}
            onCheckedChange={(checked) => {
              field.onChange(checked ? 'team_average' : undefined);
            }}
          />
          <Label htmlFor={id}>{w.teamAverage}</Label>
        </div>
      )}
    />
  );
}

function RuleParams({ index, type, timeZone }: { index: number; type: string; timeZone: string }) {
  const base = `eligibility.rules.${String(index)}`;
  const params = `${base}.params`;
  switch (type) {
    case 'region':
      return (
        <CheckboxGroup
          name={`${params}.regions` as Name}
          label={w.regions}
          options={regionOptions}
        />
      );
    case 'country':
      return <ListInput name={`${params}.countries` as Name} label={w.countries} upper />;
    case 'rank_min':
    case 'rank_max':
      return <RankInput name={`${params}.rank`} />;
    case 'peak_rank_max':
      return (
        <>
          <RankInput name={`${params}.rank`} />
          <NumberInput
            name={`${params}.windowDays` as Name}
            label={w.windowDays}
            min={1}
            max={365}
          />
        </>
      );
    case 'account_level_min':
      return <NumberInput name={`${params}.level` as Name} label={w.level} min={0} />;
    case 'account_age_min':
      return <NumberInput name={`${params}.days` as Name} label={w.days} min={0} />;
    case 'ranked_games_min':
      return <NumberInput name={`${params}.games` as Name} label={w.games} min={0} />;
    case 'age_min':
      return <NumberInput name={`${params}.years` as Name} label={w.years} min={0} max={99} />;
    case 'gender':
      return (
        <>
          <CheckboxGroup
            name={`${params}.allowed` as Name}
            label={w.gendersAllowed}
            options={genderOptions}
          />
          <DateTimeInput
            name={`${params}.declaredBefore` as Name}
            label={w.declaredBefore}
            timeZone={timeZone}
          />
        </>
      );
    case 'institution':
      return <ListInput name={`${params}.emailDomains` as Name} label={w.emailDomains} />;
    case 'max_tier_roster':
      return (
        <SelectInput
          name={`${params}.tier` as Name}
          label={w.maxTier}
          options={tierOptions}
          numeric
        />
      );
    default:
      return null;
  }
}

export function EligibilityStep() {
  const { control } = useFormContext<TournamentConfigInput>();
  const rules = useFieldArray({ control, name: 'eligibility.rules' });
  const timeZone = useWatch({ control, name: 'basics.timezone' });
  const [adding, setAdding] = useState<EligibilityRuleType | null>(null);
  const used = new Set(rules.fields.map((f) => f.type));
  const available = ELIGIBILITY_RULE_TYPES.filter((type) => !used.has(type)).map((value) => ({
    value,
    label: ruleLabels[value],
  }));

  return (
    <div className="flex flex-col gap-6">
      <StepIntro>{w.intro}</StepIntro>
      <SelectInput
        name="eligibility.exclusivityScope"
        label={w.exclusivity}
        hint={w.exclusivityHint}
        options={exclusivityOptions}
      />
      {rules.fields.length === 0 && <p className="text-sm text-text-muted">{w.noRules}</p>}
      <ul className="flex flex-col gap-3">
        {rules.fields.map((rule, index) => (
          <li key={rule.id}>
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-lg font-bold text-text">
                    {ruleLabels[rule.type]}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${w.remove}: ${ruleLabels[rule.type]}`}
                    onClick={() => {
                      rules.remove(index);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <RuleParams index={index} type={rule.type} timeZone={timeZone} />
                {RANK_RULES.has(rule.type) && (
                  <TeamAverageSwitch name={`eligibility.rules.${String(index)}`} />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64">
            <SelectField
              label={w.addRule}
              value={adding}
              onChange={setAdding}
              options={available}
              placeholder={w.chooseRule}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!adding}
            onClick={() => {
              if (!adding) return;
              rules.append(defaultRule(adding));
              setAdding(null);
            }}
          >
            {w.addRule}
          </Button>
        </div>
      )}
    </div>
  );
}
