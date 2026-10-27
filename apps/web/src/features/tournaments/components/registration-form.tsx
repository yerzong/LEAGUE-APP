'use client';

import type {
  RegistrationCheck,
  RegistrationContext,
  RosterEntryRequest,
  RosterRole,
} from '@league/contracts';
import { format } from '@league/i18n';
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Label,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  toast,
} from '@league/ui';
import { CircleCheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';

import { checkRegistration, register } from '../actions';
import { formatMoney } from '../format';
import { FailureList } from './failure-list';
import { RulebookView } from './rulebook-view';

const t = messages.tournaments;
const r = t.portal.register_page;

type Context = RegistrationContext;
type Choice = RosterRole | 'out';

const PLAYING = new Set(['captain', 'co_captain', 'player', 'substitute']);

/** Starters first (captain first), then substitutes, up to the roster rules. */
function defaultRoster(
  members: Context['teams'][number]['members'],
  starters: number,
): Record<string, Choice> {
  const ordered = [...members].sort(
    (a, b) => Number(b.teamRole === 'captain') - Number(a.teamRole === 'captain'),
  );
  let taken = 0;
  return Object.fromEntries(
    ordered.map((m) => {
      if (!PLAYING.has(m.teamRole)) return [m.userId, 'out'];
      taken += 1;
      return [m.userId, taken <= starters ? 'starter' : 'out'];
    }),
  );
}

export function RegistrationForm({ context }: { context: Context }) {
  const router = useRouter();
  const { tournament, teams, me } = context;
  const solo = tournament.entrantKind === 'solo';
  const registeredTeams = new Set(
    context.myRegistrations
      .filter((x) => ['pending', 'approved', 'waitlisted'].includes(x.status))
      .map((x) => x.teamId),
  );
  const available = teams.filter((team) => !registeredTeams.has(team.id));
  const [teamId, setTeamId] = useState<string | null>(available[0]?.id ?? null);
  const team = teams.find((x) => x.id === teamId) ?? null;
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    team ? defaultRoster(team.members, tournament.roster.starters) : {},
  );
  const [accepted, setAccepted] = useState(false);
  const [check, setCheck] = useState<RegistrationCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const acceptId = useId();

  const roster: RosterEntryRequest[] = useMemo(
    () =>
      solo
        ? [{ userId: me.userId, role: 'starter', gameRole: null }]
        : Object.entries(choices).flatMap(([userId, choice]) =>
            choice === 'out' ? [] : [{ userId, role: choice, gameRole: null }],
          ),
    [choices, me.userId, solo],
  );
  const names = useMemo(
    () =>
      new Map([
        ...(team?.members ?? []).map(
          (m) => [m.userId, m.displayName ?? m.username ?? '—'] as const,
        ),
        [me.userId, t.portal.you] as const,
      ]),
    [team, me.userId],
  );

  // Live validation: the API evaluates the same rules (packages/core) as on submit.
  useEffect(() => {
    let canceled = false;
    const timer = setTimeout(() => {
      if (roster.length === 0) {
        setCheck(null);
        return;
      }
      setChecking(true);
      void checkRegistration(tournament.id, { teamId: solo ? null : teamId, roster }).then(
        (result) => {
          if (canceled) return;
          setChecking(false);
          if (result.ok) setCheck(result.data);
        },
      );
    }, 300);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [roster, teamId, solo, tournament.id]);

  if (!solo && teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-text">{r.noTeams}</p>
          <Button asChild variant="outline">
            <Link href="/app/equipos/nuevo">{r.createTeam}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!solo && available.length === 0) return null;

  const submit = async () => {
    if (!accepted) return;
    setSending(true);
    const result = await register(tournament.id, {
      teamId: solo ? null : teamId,
      roster,
      rulebookVersionId: tournament.rulebook?.id ?? null,
      acceptRules: true,
    });
    setSending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.data.status === 'waitlisted' ? r.waitlisted : r.submitted);
    router.refresh();
  };

  const roleOptions = [
    { value: 'starter' as const, label: t.options.rosterRoles.starter },
    { value: 'substitute' as const, label: t.options.rosterRoles.substitute },
    ...(tournament.roster.coachAllowed
      ? [{ value: 'coach' as const, label: t.options.rosterRoles.coach }]
      : []),
  ];

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {!solo && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="font-display text-lg font-bold text-text caps">{r.chooseTeam}</h2>
            <RadioGroup
              value={teamId ?? ''}
              onValueChange={(value) => {
                setTeamId(value);
                const next = teams.find((x) => x.id === value);
                setChoices(next ? defaultRoster(next.members, tournament.roster.starters) : {});
              }}
              className="flex flex-wrap gap-4"
            >
              {available.map((x) => (
                <Label key={x.id} className="flex items-center gap-2">
                  <RadioGroupItem value={x.id} />
                  {x.name} [{x.tag}]
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {team && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-lg font-bold text-text caps">{r.roster}</h2>
              <p className="text-sm text-text-muted">
                {format(r.rosterHint, {
                  starters: tournament.roster.starters,
                  subs: tournament.roster.maxSubstitutes,
                  coach: tournament.roster.coachAllowed ? r.rosterCoach : '',
                })}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {team.members.map((member) => {
                const name = member.displayName ?? member.username ?? '—';
                const choice = choices[member.userId] ?? 'out';
                return (
                  <li
                    key={member.userId}
                    className="grid items-end gap-3 border-b border-border pb-3 sm:grid-cols-2"
                  >
                    <Label className="flex items-center gap-2">
                      <Checkbox
                        checked={choice !== 'out'}
                        aria-label={format(r.include, { name })}
                        onCheckedChange={(checked) => {
                          setChoices((current) => ({
                            ...current,
                            [member.userId]: checked === true ? 'substitute' : 'out',
                          }));
                        }}
                      />
                      <span className="flex flex-col">
                        <span className="text-text">{name}</span>
                        <span className="text-xs text-text-muted">
                          {
                            messages.options.teamRoles[
                              member.teamRole as keyof typeof messages.options.teamRoles
                            ]
                          }
                        </span>
                      </span>
                    </Label>
                    {choice !== 'out' && (
                      <SelectField
                        label={format(r.role, { name })}
                        value={choice}
                        onChange={(value) => {
                          setChoices((current) => ({
                            ...current,
                            [member.userId]: value ?? 'out',
                          }));
                        }}
                        options={roleOptions}
                        placeholder={r.roster}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3" aria-live="polite">
          <h2 className="font-display text-lg font-bold text-text caps">{r.validation}</h2>
          {checking ? (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner label={r.checking} /> {r.checking}
            </p>
          ) : check?.ok ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CircleCheckIcon aria-hidden className="size-4" /> {r.allGood}
            </p>
          ) : check ? (
            <FailureList
              failures={check.failures}
              violations={check.rosterViolations}
              blockers={check.blockers}
              names={names}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold text-text caps">
            {tournament.rulebook
              ? format(r.rulebook, { version: tournament.rulebook.version })
              : r.noRulebook}
          </h2>
          {tournament.rulebook && (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border p-4">
              <RulebookView content={tournament.rulebook.content} />
            </div>
          )}
          {tournament.fee && (
            <p className="text-sm text-warning">
              {format(r.fee, { amount: formatMoney(tournament.fee.amount) })}
            </p>
          )}
          <Label htmlFor={acceptId} className="flex items-center gap-2">
            <Checkbox
              id={acceptId}
              checked={accepted}
              onCheckedChange={(checked) => {
                setAccepted(checked === true);
              }}
            />
            {r.accept}
          </Label>
          <div>
            <Button type="submit" disabled={!accepted || sending || !check?.ok}>
              {r.submit}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
