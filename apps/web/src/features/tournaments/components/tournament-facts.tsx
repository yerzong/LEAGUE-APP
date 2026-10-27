import type { PublicTournamentDetail } from '@league/contracts';
import { format } from '@league/i18n';
import { Card, CardContent } from '@league/ui';
import { CheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';

import { formatDateTime, formatMoney, phaseDetail, ruleSummary } from '../format';

const t = messages.tournaments;
const d = t.public.detail;
const o = t.options;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-muted caps">{label}</dt>
      <dd className="text-text">{children}</dd>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-display text-2xl font-bold text-text caps">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Information, format, eligibility and prizes of a tournament (public page and portal). */
export function TournamentFacts({ tournament }: { tournament: PublicTournamentDetail }) {
  const tz = tournament.timezone;
  const roster = format(d.roster, {
    starters: tournament.roster.starters,
    subs: tournament.roster.maxSubstitutes,
    coach: tournament.roster.coachAllowed ? d.rosterCoach : '',
  });
  return (
    <div className="flex flex-col gap-10">
      <Section id="info" title={d.info}>
        {tournament.description && (
          <p className="max-w-prose whitespace-pre-line text-text">{tournament.description}</p>
        )}
        <Card>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label={d.gameMode}>
                {format(t.public.gameMode, {
                  size: tournament.teamSize,
                  map: o.maps[tournament.map],
                })}
              </Fact>
              <Fact label={d.pickType}>{o.pickTypes[tournament.pickType]}</Fact>
              <Fact label={d.modality}>{o.modalities[tournament.modality]}</Fact>
              {tournament.venue && (
                <Fact label={d.venue}>
                  {tournament.venue.name} · {tournament.venue.city}
                </Fact>
              )}
              <Fact label={d.capacity}>{tournament.capacity ?? d.unlimited}</Fact>
              <Fact label={d.fee}>
                {tournament.fee ? formatMoney(tournament.fee.amount) : d.free}
              </Fact>
              <Fact label={d.supervision}>{o.supervision[tournament.supervisionLevel]}</Fact>
              <Fact label={d.dates}>
                <span className="flex flex-col">
                  {tournament.registrationOpensAt && tournament.registrationClosesAt && (
                    <span>
                      {format(d.registrationWindow, {
                        opens: formatDateTime(tournament.registrationOpensAt, tz),
                        closes: formatDateTime(tournament.registrationClosesAt, tz),
                      })}
                    </span>
                  )}
                  {tournament.startsAt && (
                    <span>
                      {format(d.startsAt, { date: formatDateTime(tournament.startsAt, tz) })}
                    </span>
                  )}
                  {tournament.endsAt && (
                    <span>{format(d.endsAt, { date: formatDateTime(tournament.endsAt, tz) })}</span>
                  )}
                  <span className="text-xs text-text-muted">
                    {format(d.timezone, {
                      timezone: (o.timezones as Readonly<Record<string, string>>)[tz] ?? tz,
                    })}
                  </span>
                </span>
              </Fact>
              <Fact label={t.sections.roster}>{roster}</Fact>
            </dl>
            {tournament.customWinCondition && (
              <p className="mt-4 text-sm text-text-muted">
                {format(d.winCondition, { condition: tournament.customWinCondition })}
              </p>
            )}
          </CardContent>
        </Card>
        {tournament.windows.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm text-text-muted caps">{d.windows}</h3>
            <ul className="flex flex-wrap gap-2 text-sm text-text">
              {tournament.windows.map((w) => (
                <li
                  key={`${String(w.weekday)}-${w.startTime}`}
                  className="rounded-sm border border-border px-2 py-1"
                >
                  {o.weekdays[w.weekday]} {w.startTime}–{w.endTime}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section id="formato" title={d.format}>
        <ol className="flex flex-col gap-3">
          {tournament.phases.map((phase) => (
            <li key={phase.position}>
              <Card>
                <CardContent className="flex flex-col gap-1">
                  <span className="font-display text-lg font-bold text-text">
                    {format(d.phase, { position: phase.position, name: phase.name })}
                  </span>
                  <span className="text-sm text-text-muted">{phaseDetail(phase)}</span>
                  {phase.groups.length > 0 && (
                    <span className="text-sm text-text-muted">
                      {format(d.groups, { groups: phase.groups.join(', ') })}
                    </span>
                  )}
                  {phase.advance !== null && (
                    <span className="text-sm text-text-muted">
                      {format(d.advance, { count: phase.advance })}
                    </span>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
        <p className="text-sm text-text-muted">{d.bracketSoon}</p>
      </Section>

      <Section id="elegibilidad" title={d.eligibility}>
        <ul className="flex flex-col gap-2 text-text">
          {[
            t.exclusivitySummary[tournament.eligibility.exclusivityScope],
            ...tournament.eligibility.rules.map(ruleSummary),
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckIcon aria-hidden className="mt-1 size-4 shrink-0 text-success" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Section>

      {tournament.prizes.length > 0 && (
        <Section id="premios" title={d.prizes}>
          {tournament.prizePoolSummary && (
            <p className="text-text">{tournament.prizePoolSummary}</p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {tournament.prizes.map((prize, index) => (
              <li key={String(index)}>
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted caps">
                      {prize.awardType === 'placement' && prize.placementFrom
                        ? prize.placementTo && prize.placementTo !== prize.placementFrom
                          ? format(d.prizeRange, {
                              from: prize.placementFrom,
                              to: prize.placementTo,
                            })
                          : format(d.prizePlacement, { from: prize.placementFrom })
                        : o.awardTypes[prize.awardType]}
                    </span>
                    <span className="font-display text-lg font-bold text-text">
                      {prize.label ?? o.prizeTypes[prize.prizeType]}
                    </span>
                    {prize.amount !== null && (
                      <span className="text-text">{formatMoney(prize.amount)}</span>
                    )}
                    {prize.description && (
                      <span className="text-sm text-text-muted">{prize.description}</span>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
