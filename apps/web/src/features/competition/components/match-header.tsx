import type { MatchDetail } from '@league/contracts';
import { format } from '@league/i18n';
import { Badge, Card, CardContent } from '@league/ui';
import { CircleCheckIcon, CircleDashedIcon } from 'lucide-react';

import { messages } from '@/config/i18n';
import { formatDateTime } from '@/features/tournaments/format';

import { FINISHED_STATUSES, MATCH_STATUS_VARIANT, matchLabel } from '../format';

const c = messages.competition;

/** Teams, score, status, time, check-in and the score per game. */
export function MatchHeader({ match }: { match: MatchDetail }) {
  const tz = match.tournament.timezone;
  const a = match.entrantA;
  const b = match.entrantB;
  const finished = FINISHED_STATUSES.has(match.status);
  const side = (entrant: MatchDetail['entrantA']) =>
    entrant ? (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="font-display text-2xl font-bold text-text">{entrant.displayName}</span>
        {entrant.displayTag && (
          <span className="text-xs text-text-muted caps">{entrant.displayTag}</span>
        )}
        {match.checkinOpensAt || match.status === 'checkin' || match.checkedIn.length > 0 ? (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            {match.checkedIn.includes(entrant.id) ? (
              <>
                <CircleCheckIcon aria-hidden className="size-3.5 text-success" />{' '}
                {c.detail.checkedIn}
              </>
            ) : (
              <>
                <CircleDashedIcon aria-hidden className="size-3.5" /> {c.detail.notCheckedIn}
              </>
            )}
          </span>
        ) : null}
      </div>
    ) : (
      <span className="text-center text-text-muted">{c.slot.tbd}</span>
    );

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
          <span>
            {match.phaseName}
            {match.groupName ? ` · ${format(c.group, { name: match.groupName })}` : ''} ·{' '}
            {matchLabel(match)} ·{' '}
            {format(c.detail.series, {
              format: messages.tournaments.options.seriesFormats[match.seriesFormat],
            })}
          </span>
          <Badge variant={MATCH_STATUS_VARIANT[match.status]}>{c.statuses[match.status]}</Badge>
        </div>
        <div className="grid grid-cols-3 items-center gap-4">
          {side(a)}
          <div className="text-center font-display text-4xl font-bold text-text tabular">
            {finished ? format(c.board.score, { a: match.scoreA, b: match.scoreB }) : c.vs}
          </div>
          {side(b)}
        </div>
        <div className="flex flex-col gap-1 text-sm text-text-muted">
          {match.scheduledAt && (
            <span>
              {format(c.detail.scheduledAt, { date: formatDateTime(match.scheduledAt, tz) })}
            </span>
          )}
          {match.checkinOpensAt && match.checkinClosesAt && (
            <span>
              {c.detail.checkin}:{' '}
              {format(c.detail.checkinWindow, {
                opens: formatDateTime(match.checkinOpensAt, tz),
                closes: formatDateTime(match.checkinClosesAt, tz),
              })}
            </span>
          )}
          {match.resultSource && (
            <span>{format(c.detail.source, { source: c.resultSources[match.resultSource] })}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm text-text-muted caps">{c.detail.games}</h2>
          {match.games.length === 0 ? (
            <p className="text-sm text-text-muted">{c.detail.noGames}</p>
          ) : (
            <ol className="flex flex-wrap gap-2">
              {match.games.map((g) => {
                const winner = g.winnerId === a?.id ? a : g.winnerId === b?.id ? b : null;
                return (
                  <li
                    key={g.number}
                    className="rounded-sm border border-border px-3 py-1.5 text-sm text-text"
                  >
                    {format(c.detail.game, { n: g.number })}:{' '}
                    {winner ? format(c.detail.gameWinner, { name: winner.displayName }) : '—'}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-text-muted">{c.detail.draftSoon}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** What each captain reported, and the disputes with their evidence (parties and staff). */
export function MatchRecords({ match }: { match: MatchDetail }) {
  const name = (id: string | null) =>
    id === match.entrantA?.id
      ? match.entrantA.displayName
      : id === match.entrantB?.id
        ? match.entrantB.displayName
        : '—';
  const s = messages.competition.admin;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-text caps">{s.reports}</h2>
          {match.reports.length === 0 ? (
            <p className="text-sm text-text-muted">{s.noReports}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {match.reports.map((r) => (
                <li key={`${r.entrantId}-${r.submittedAt}`} className="flex flex-col gap-1">
                  <span className="text-text">
                    {name(r.entrantId)}: {format(c.board.score, { a: r.scoreA, b: r.scoreB })} ·{' '}
                    {format(c.detail.gameWinner, { name: name(r.winnerId) })}
                  </span>
                  {r.evidenceUrls.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand underline"
                    >
                      {s.evidence} {i + 1}
                    </a>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-text caps">{s.disputes}</h2>
          {match.disputes.length === 0 ? (
            <p className="text-sm text-text-muted">{s.noDisputes}</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {match.disputes.map((d) => (
                <li key={d.id} className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        d.status === 'open' || d.status === 'under_review' ? 'danger' : 'secondary'
                      }
                    >
                      {c.disputeStatuses[d.status]}
                    </Badge>
                    <span className="text-text-muted">{c.disputeCategories[d.category]}</span>
                  </span>
                  <span className="text-text">
                    {(c.disputeCodes as Readonly<Record<string, string>>)[d.description] ??
                      d.description}
                  </span>
                  {d.resolution && <span className="text-text-muted">{d.resolution}</span>}
                  {d.evidence.map((e) => (
                    <span key={e.id} className="text-xs text-text-muted">
                      {e.note}
                      {e.url && (
                        <>
                          {' '}
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand underline"
                          >
                            {s.evidence}
                          </a>
                        </>
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
