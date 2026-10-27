'use client';

// Staff actions on a match (docs/14 §3.3 Partidas): check-in, confirm or
// correct the result, forfeit, disputes, reschedules and the time. Sensitive
// ones ask for a reason, which goes to the audit log.

import type { MatchDetail } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  Field,
  FormField,
  Textarea,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';
import { formatDateTime, fromZonedInput, toZonedInput } from '@/features/tournaments/format';

import {
  decideReschedule,
  resolveDispute,
  runMatchAction,
  setMatchTime,
  staffForfeit,
  staffResult,
} from '../actions';
import { GamesInput, initialGames } from './games-input';

const c = messages.competition;
const s = c.admin;
const reasonField = {
  label: messages.tournaments.reason.label,
  hint: messages.tournaments.reason.hint,
  placeholder: messages.tournaments.reason.placeholder,
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

const RESULT = new Set(['ready', 'live', 'awaiting_result', 'disputed', 'completed']);
const FORFEIT = new Set(['pending', 'scheduled', 'checkin', 'ready', 'live', 'awaiting_result']);
const SCHEDULABLE = new Set(['pending', 'scheduled']);

export function StaffMatchPanel({ match }: { match: MatchDetail }) {
  const router = useRouter();
  const tz = match.tournament.timezone;
  const [games, setGames] = useState(() => initialGames(match.seriesFormat));
  const [loser, setLoser] = useState<'a' | 'b'>('b');
  const [time, setTime] = useState(toZonedInput(match.scheduledAt, tz));
  const [timeReason, setTimeReason] = useState('');
  const [outcome, setOutcome] = useState<'keep' | 'override' | 'reject'>('override');
  const [resolution, setResolution] = useState('');
  const known = match.entrantA !== null && match.entrantB !== null;
  const names = { a: match.entrantA?.displayName ?? 'A', b: match.entrantB?.displayName ?? 'B' };

  const done = (message: string) => (result: { ok: boolean; message?: string }) => {
    if (!result.ok) {
      toast.error(result.message ?? messages.errors.unknown);
      return;
    }
    toast.success(message);
    router.refresh();
  };

  const openDispute = match.disputes.find(
    (d) => d.status === 'open' || d.status === 'under_review',
  );
  const agreed = match.reschedules.find((r) => r.status === 'accepted' || r.status === 'pending');

  return (
    <div className="flex flex-col gap-4">
      {known &&
        (match.status === 'pending' ||
          match.status === 'scheduled' ||
          match.status === 'checkin') && (
          <Panel title={s.checkins}>
            <div className="flex flex-wrap gap-2">
              {match.status !== 'checkin' ? (
                <Button
                  onClick={() =>
                    void runMatchAction(match.id, 'open_checkin').then(done(s.checkinOpened))
                  }
                >
                  {s.openCheckin}
                </Button>
              ) : (
                <ConfirmDialog
                  trigger={<Button variant="secondary">{s.closeCheckin}</Button>}
                  title={s.closeCheckin}
                  description={s.closeCheckinDescription}
                  confirmLabel={s.closeCheckin}
                  cancelLabel={messages.common.cancel}
                  onConfirm={async () => {
                    done(s.checkinClosed)(await runMatchAction(match.id, 'close_checkin'));
                  }}
                />
              )}
            </div>
          </Panel>
        )}

      {known && RESULT.has(match.status) && (
        <Panel title={s.resultTitle}>
          <p className="text-sm text-text-muted">{s.resultDescription}</p>
          <GamesInput format={match.seriesFormat} names={names} value={games} onChange={setGames} />
          <div>
            <ConfirmDialog
              trigger={
                <Button>
                  {match.status === 'completed' || match.status === 'disputed'
                    ? s.overrideResult
                    : s.confirmResult}
                </Button>
              }
              title={s.resultTitle}
              description={s.resultDescription}
              confirmLabel={s.confirmResult}
              cancelLabel={messages.common.cancel}
              reason={reasonField}
              onConfirm={async (reason) => {
                done(s.resultSaved)(await staffResult(match.id, { games, reason: reason ?? '' }));
              }}
            />
          </div>
        </Panel>
      )}

      {known && FORFEIT.has(match.status) && (
        <Panel title={s.forfeit}>
          <SelectField
            label={s.forfeitLoser}
            value={loser}
            onChange={(value) => {
              if (value) setLoser(value);
            }}
            options={[
              { value: 'a' as const, label: names.a },
              { value: 'b' as const, label: names.b },
            ]}
            placeholder={s.forfeitLoser}
          />
          <div>
            <ConfirmDialog
              trigger={<Button variant="secondary">{s.forfeit}</Button>}
              title={s.forfeitTitle}
              description={s.forfeitDescription}
              confirmLabel={s.forfeit}
              cancelLabel={messages.common.cancel}
              destructive
              reason={reasonField}
              onConfirm={async (reason) => {
                done(s.forfeited)(await staffForfeit(match.id, { loser, reason: reason ?? '' }));
              }}
            />
          </div>
        </Panel>
      )}

      {openDispute && (
        <Panel title={s.resolve}>
          <SelectField
            label={s.outcome}
            value={outcome}
            onChange={(value) => {
              if (value) setOutcome(value);
            }}
            options={(['override', 'keep', 'reject'] as const).map((value) => ({
              value,
              label: s.outcomes[value],
            }))}
            placeholder={s.outcome}
          />
          {outcome === 'override' && (
            <GamesInput
              format={match.seriesFormat}
              names={names}
              value={games}
              onChange={setGames}
            />
          )}
          <Field label={s.resolution} hint={messages.tournaments.reason.hint}>
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                }}
              />
            )}
          </Field>
          <div>
            <Button
              disabled={resolution.trim().length < 10}
              onClick={() =>
                void resolveDispute(openDispute.id, {
                  resolution: resolution.trim(),
                  outcome,
                  games: outcome === 'override' ? games : null,
                }).then(done(s.resolved))
              }
            >
              {s.resolve}
            </Button>
          </div>
        </Panel>
      )}

      {agreed && (
        <Panel title={s.reschedules}>
          <p className="text-sm text-text">
            {c.rescheduleStatuses[agreed.status]}
            {agreed.chosenAt ? ` · ${formatDateTime(agreed.chosenAt, tz)}` : ''}
          </p>
          <ul className="flex flex-col gap-1 text-sm text-text-muted">
            {agreed.proposedAt.map((at) => (
              <li key={at}>{formatDateTime(at, tz)}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {agreed.status === 'accepted' && (
              <Button
                onClick={() =>
                  void decideReschedule(agreed.id, { decision: 'approve', reason: null }).then(
                    done(s.rescheduleApproved),
                  )
                }
              >
                {s.approve}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                void decideReschedule(agreed.id, { decision: 'reject', reason: null }).then(
                  done(s.rescheduleRejected),
                )
              }
            >
              {s.reject}
            </Button>
          </div>
        </Panel>
      )}

      {SCHEDULABLE.has(match.status) && (
        <Panel title={s.setTime}>
          <FormField
            label={s.time}
            type="datetime-local"
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
            }}
          />
          {match.scheduledAt && (
            <FormField
              label={messages.tournaments.reason.label}
              hint={messages.tournaments.reason.hint}
              value={timeReason}
              onChange={(e) => {
                setTimeReason(e.target.value);
              }}
            />
          )}
          <div>
            <Button
              variant="secondary"
              disabled={
                time === '' || (match.scheduledAt !== null && timeReason.trim().length < 10)
              }
              onClick={() => {
                const scheduledAt = fromZonedInput(time, tz);
                if (!scheduledAt) return;
                void setMatchTime(match.id, {
                  scheduledAt,
                  reason: timeReason.trim() === '' ? null : timeReason.trim(),
                }).then(done(s.timeSaved));
              }}
            >
              {s.saveTime}
            </Button>
          </div>
          {match.scheduledAt && (
            <p className="text-xs text-text-muted">
              {format(c.detail.scheduledAt, { date: formatDateTime(match.scheduledAt, tz) })}
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
