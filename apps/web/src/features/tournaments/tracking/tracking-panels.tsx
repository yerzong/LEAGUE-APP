// Server-rendered panels of the event page (docs/14 §3.3).
import type {
  AuditEntry,
  EditMode,
  Registration,
  TournamentDetail,
  TournamentSection,
} from '@league/contracts';
import { TOURNAMENT_SECTION_KEYS } from '@league/contracts';
import { format } from '@league/i18n';
import { Badge, Card, CardContent, EmptyState, Timeline } from '@league/ui';
import {
  CalendarClockIcon,
  GitForkIcon,
  ListOrderedIcon,
  SwordsIcon,
  UsersIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';

import { RulebookEditor } from '../components/rulebook-editor';
import { SaveTemplate } from '../components/save-template';
import { StructurePreview } from '../components/structure-preview';
import { formatDateTime } from '../format';
import { RegistrationReview } from './registration-review';
import { SeedingPanel } from './seeding-panel';
import { TournamentActions } from './tournament-actions';

const t = messages.tournaments;
const tr = t.tracking;

const MODE_VARIANT: Readonly<Record<EditMode, 'success' | 'warning' | 'outline'>> = {
  free: 'success',
  confirm: 'warning',
  locked: 'outline',
};

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-bold text-text caps">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3">
      <span className="text-xs text-text-muted caps">{label}</span>
      <span className="font-display text-2xl text-text tabular">{value}</span>
    </div>
  );
}

export function SummaryPanel({
  detail,
  registrations,
}: {
  detail: TournamentDetail;
  registrations: Registration[];
}) {
  const s = tr.summary;
  const tz = detail.config.basics.timezone;
  const count = (status: Registration['status']) =>
    registrations.filter((r) => r.status === status).length;
  const {
    registrationOpensAt: opens,
    registrationClosesAt: closes,
    startsAt,
  } = detail.config.schedule;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={s.approved} value={count('approved')} />
        <Stat label={s.pending} value={count('pending')} />
        <Stat label={s.waitlisted} value={count('waitlisted')} />
        <Stat label={s.capacity} value={detail.capacity ?? s.unlimited} />
      </div>
      <Panel title={s.actions}>
        <TournamentActions detail={detail} />
        {detail.publishIssues.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">{s.publishIssues}</span>
            <ul className="list-disc pl-5 text-danger">
              {detail.publishIssues.map((issue) => (
                <li key={issue}>
                  {(t.publishIssues as Readonly<Record<string, string>>)[issue] ?? issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>
      <Panel title={s.dates}>
        {opens || closes || startsAt ? (
          <ul className="flex flex-col gap-1 text-sm text-text">
            {opens && closes && (
              <li>
                {format(s.registrationWindow, {
                  opens: formatDateTime(opens, tz),
                  closes: formatDateTime(closes, tz),
                })}
              </li>
            )}
            {startsAt && <li>{format(s.startsAt, { date: formatDateTime(startsAt, tz) })}</li>}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{s.notScheduled}</p>
        )}
      </Panel>
      <Panel title={s.structure}>
        <StructurePreview config={detail.config} preview={detail.preview} />
      </Panel>
    </>
  );
}

const GROUPS: { key: keyof typeof tr.registrations.groups; statuses: Registration['status'][] }[] =
  [
    { key: 'pending', statuses: ['pending'] },
    { key: 'approved', statuses: ['approved'] },
    { key: 'waitlisted', statuses: ['waitlisted'] },
    { key: 'closed', statuses: ['rejected', 'withdrawn', 'disqualified'] },
  ];

export function RegistrationsPanel({
  detail,
  registrations,
}: {
  detail: TournamentDetail;
  registrations: Registration[];
}) {
  if (registrations.length === 0)
    return <EmptyState icon={<UsersIcon />} title={tr.registrations.empty} />;
  const canDecide = ['published', 'registration_open', 'registration_closed'].includes(
    detail.status,
  );
  return (
    <>
      {GROUPS.map((group) => {
        const list = registrations.filter((r) => group.statuses.includes(r.status));
        if (list.length === 0) return null;
        return (
          <section
            key={group.key}
            className="flex flex-col gap-3"
            aria-label={tr.registrations.groups[group.key]}
          >
            <h2 className="caps text-sm text-text-muted">
              {tr.registrations.groups[group.key]} · {list.length}
            </h2>
            {list.map((registration) => (
              <RegistrationReview
                key={registration.id}
                registration={registration}
                timeZone={detail.config.basics.timezone}
                canDecide={canDecide}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}

export function ParticipantsPanel({
  detail,
  registrations,
}: {
  detail: TournamentDetail;
  registrations: Registration[];
}) {
  const p = tr.participants;
  const approved = registrations.filter((r) => r.status === 'approved');
  const canSeed = detail.status === 'registration_closed' || detail.status === 'seeding';
  return (
    <>
      {approved.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title={p.empty} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {approved.map((registration) => (
            <li key={registration.id}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-2">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-lg font-bold text-text">
                      {registration.displayName}
                    </span>
                    <Badge variant="outline">
                      {p.seed} {registration.seed ?? p.noSeed}
                    </Badge>
                  </span>
                  <ul className="flex flex-col gap-1 text-sm text-text-muted">
                    {registration.roster.map((member) => (
                      <li key={member.userId}>
                        {member.displayName ?? member.username ?? '—'} ·{' '}
                        {t.options.rosterRoles[member.role]}
                        {member.riotId ? ` · ${member.riotId}` : ''}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Panel title={p.seedingTitle}>
        {canSeed ? (
          <SeedingPanel
            tournamentId={detail.id}
            approved={approved}
            defaultMethod={detail.config.format.seedingMethod}
          />
        ) : (
          <p className="text-sm text-text-muted">{p.seedingHint}</p>
        )}
      </Panel>
    </>
  );
}

export function PhasesPanel({ detail }: { detail: TournamentDetail }) {
  const ph = tr.phases;
  if (detail.phases.length === 0) return <EmptyState icon={<GitForkIcon />} title={ph.empty} />;
  return (
    <>
      <p className="text-sm text-text-muted">{ph.intro}</p>
      <ol className="flex flex-col gap-3">
        {detail.phases.map((phase) => (
          <li key={phase.id}>
            <Card>
              <CardContent className="flex flex-col gap-2">
                <span className="font-display text-lg font-bold text-text">
                  {phase.position}. {phase.name}
                </span>
                <span className="text-sm text-text-muted">
                  {t.options.formats[phase.format]} ·{' '}
                  {format(ph.series, { format: t.options.seriesFormats[phase.seriesFormat] })}
                </span>
                {phase.groups.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    {phase.groups.map((group) => (
                      <Badge key={group.id} variant="outline">
                        {format(ph.group, { name: group.name })}
                      </Badge>
                    ))}
                  </span>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <NextDelivery icon={<GitForkIcon />} />
    </>
  );
}

export function CalendarPanel({ detail }: { detail: TournamentDetail }) {
  const c = tr.calendar;
  const { windows, blackouts } = detail.config.schedule;
  const tz = detail.config.basics.timezone;
  return (
    <>
      <Panel title={c.windows}>
        {windows.length === 0 ? (
          <p className="text-sm text-text-muted">{c.noWindows}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-text">
            {windows.map((w) => (
              <li key={`${String(w.weekday)}-${w.startTime}`}>
                {format(c.window, {
                  weekday: t.options.weekdays[w.weekday] ?? '',
                  start: w.startTime,
                  end: w.endTime,
                  slot: w.slotMinutes,
                  parallel: w.parallelMatches,
                })}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={c.blackouts}>
        {blackouts.length === 0 ? (
          <p className="text-sm text-text-muted">{c.noBlackouts}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-text">
            {blackouts.map((b) => (
              <li key={b.startsAt}>
                {formatDateTime(b.startsAt, tz)} – {formatDateTime(b.endsAt, tz)}
                {b.reason ? ` · ${b.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <NextDelivery icon={<CalendarClockIcon />} />
    </>
  );
}

export function NextDelivery({ icon = <SwordsIcon /> }: { icon?: ReactNode }) {
  return (
    <EmptyState icon={icon} title={tr.nextDelivery} description={tr.nextDeliveryDescription} />
  );
}

export function StandingsPlaceholder() {
  return <NextDelivery icon={<ListOrderedIcon />} />;
}

export function SettingsPanel({ detail }: { detail: TournamentDetail }) {
  const s = tr.settings;
  return (
    <>
      <Panel title={s.policyTitle}>
        <p className="text-sm text-text-muted">{s.policyDescription}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {TOURNAMENT_SECTION_KEYS.map((section: TournamentSection) => {
            const mode = detail.editPolicy[section];
            return (
              <div
                key={section}
                className="flex items-center justify-between gap-2 border-b border-border py-1.5"
              >
                <dt className="text-sm text-text">{t.sections[section]}</dt>
                <dd>
                  <Badge variant={MODE_VARIANT[mode]}>{t.options.editModes[mode]}</Badge>
                </dd>
              </div>
            );
          })}
        </dl>
      </Panel>
      <Panel title={s.rulebookTitle}>
        <RulebookEditor detail={detail} />
        {detail.rulebook && detail.rulebook.versions.length > 0 && (
          <div className="flex flex-col gap-1 text-sm text-text-muted">
            <span className="caps text-xs">{s.versions}</span>
            <ul>
              {detail.rulebook.versions
                .filter((v) => v.publishedAt)
                .map((v) => (
                  <li key={v.id}>
                    {format(s.versionItem, {
                      version: v.version,
                      date: v.publishedAt
                        ? formatDateTime(v.publishedAt, detail.config.basics.timezone)
                        : '',
                    })}
                    {v.changeSummary ? ` · ${v.changeSummary}` : ''}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Panel>
      <Panel title={s.saveAsTemplate}>
        <SaveTemplate config={detail.config} />
      </Panel>
    </>
  );
}

export function AuditPanel({
  detail,
  entries,
}: {
  detail: TournamentDetail;
  entries: AuditEntry[];
}) {
  const a = tr.audit;
  if (entries.length === 0) return <EmptyState title={a.empty} />;
  const tz = detail.config.basics.timezone;
  return (
    <Card>
      <CardContent>
        <Timeline
          label={tr.tabs.audit}
          items={entries.map((entry) => {
            const sections = Array.isArray(entry.after?.sections)
              ? (entry.after.sections as string[])
              : [];
            const actor = entry.actor
              ? (entry.actor.displayName ?? entry.actor.username ?? a.staff)
              : a.system;
            return {
              id: entry.id,
              title: (a.actions as Readonly<Record<string, string>>)[entry.action] ?? entry.action,
              meta: `${actor} · ${formatDateTime(entry.createdAt, tz)}`,
              description:
                sections.length > 0 || entry.reason ? (
                  <span className="flex flex-col">
                    {sections.length > 0 && (
                      <span>
                        {format(a.sections, {
                          sections: sections
                            .map((s) => (t.sections as Readonly<Record<string, string>>)[s] ?? s)
                            .join(', '),
                        })}
                      </span>
                    )}
                    {entry.reason && <span>{format(a.reason, { reason: entry.reason })}</span>}
                  </span>
                ) : undefined,
            };
          })}
        />
      </CardContent>
    </Card>
  );
}
