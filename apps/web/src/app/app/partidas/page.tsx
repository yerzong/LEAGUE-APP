import type { MyMatch } from '@league/contracts';
import { format } from '@league/i18n';
import { Badge, EmptyState, PageHeader } from '@league/ui';
import { SwordsIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { getMyMatches } from '@/features/competition/api';
import { FINISHED_STATUSES, MATCH_STATUS_VARIANT } from '@/features/competition/format';
import { LoadError } from '@/features/shell/load-error';
import { formatDateTime } from '@/features/tournaments/format';

const c = messages.competition;
const p = c.portal;

export const metadata: Metadata = { title: p.title };

function opponentOf(m: MyMatch) {
  return m.entrantA?.id === m.myEntrantId ? m.entrantB : m.entrantA;
}

function MatchRow({ match }: { match: MyMatch }) {
  const me = match.entrantA?.id === match.myEntrantId ? match.entrantA : match.entrantB;
  const rival = opponentOf(match);
  const finished = FINISHED_STATUSES.has(match.status);
  const mine = match.entrantA?.id === match.myEntrantId;
  const need =
    match.status === 'checkin'
      ? p.needsCheckin
      : ['ready', 'live', 'awaiting_result'].includes(match.status)
        ? p.needsReport
        : null;
  return (
    <li>
      <Link
        href={`/app/partidas/${match.id}`}
        className="focus-ring flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3 hover:border-brand"
      >
        <span className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">
            {match.tournament.name} · {match.phaseName}
          </span>
          <span className="font-display text-lg text-text">
            {me?.displayName} {c.vs} {rival?.displayName ?? c.slot.tbd}
            {finished && (
              <span className="ml-2 tabular text-text-muted">
                {format(c.board.score, {
                  a: mine ? match.scoreA : match.scoreB,
                  b: mine ? match.scoreB : match.scoreA,
                })}
              </span>
            )}
          </span>
          <span className="text-xs text-text-muted">
            {match.scheduledAt
              ? formatDateTime(match.scheduledAt, match.tournament.timezone)
              : c.board.noSchedule}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <Badge variant={MATCH_STATUS_VARIANT[match.status]}>{c.statuses[match.status]}</Badge>
          {need && <span className="text-xs font-semibold text-warning">{need}</span>}
        </span>
      </Link>
    </li>
  );
}

export default async function MyMatchesPage() {
  const result = await getMyMatches();
  if (!result.ok) return <LoadError code={result.code} />;
  const upcoming = result.data.filter((m) => !FINISHED_STATUSES.has(m.status));
  const past = result.data.filter((m) => FINISHED_STATUSES.has(m.status));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={p.title} description={p.description} />
      {result.data.length === 0 ? (
        <EmptyState icon={<SwordsIcon />} title={p.empty} description={p.emptyDescription} />
      ) : (
        <>
          <section aria-labelledby="calendar" className="flex flex-col gap-3">
            <h2 id="calendar" className="caps text-sm text-text-muted">
              {p.calendar}
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-text-muted">{p.noUpcoming}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcoming.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="results" className="flex flex-col gap-3">
              <h2 id="results" className="caps text-sm text-text-muted">
                {p.results}
              </h2>
              <ul className="flex flex-col gap-2">
                {past.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
