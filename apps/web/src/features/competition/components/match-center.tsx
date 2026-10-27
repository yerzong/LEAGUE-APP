'use client';

// Match center of the portal (docs/14 §4): what a captain can do on the match,
// following the permissions the API computed.

import { IMAGE_UPLOAD, type DisputeCategory, type MatchDetail } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, Card, CardContent, Field, FormField, Textarea, toast, Uploader } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { SelectField } from '@/features/forms/select-field';
import { formatDateTime, fromZonedInput } from '@/features/tournaments/format';

import {
  addDisputeEvidence,
  checkIn,
  openDispute,
  reportResult,
  requestReschedule,
  respondReschedule,
  uploadEvidence,
} from '../actions';
import { GamesInput, initialGames } from './games-input';

const c = messages.competition;
const p = c.portal;

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

const categoryOptions = (Object.keys(c.disputeCategories) as DisputeCategory[]).map((value) => ({
  value,
  label: c.disputeCategories[value],
}));

export function MatchCenter({ match }: { match: MatchDetail }) {
  const router = useRouter();
  const permissions = match.permissions;
  const [games, setGames] = useState(() => initialGames(match.seriesFormat));
  const [evidence, setEvidence] = useState<string[]>([]);
  const [category, setCategory] = useState<DisputeCategory>('result');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [options, setOptions] = useState(['', '', '']);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!permissions?.entrantId) return null;
  const tz = match.tournament.timezone;
  const names = { a: match.entrantA?.displayName ?? 'A', b: match.entrantB?.displayName ?? 'B' };

  const run = async (action: () => Promise<{ ok: boolean; message?: string }>, success: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? messages.errors.unknown);
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  };

  const openDisputeHere = match.disputes.find(
    (d) => d.status === 'open' || d.status === 'under_review',
  );
  const pendingReschedule = match.reschedules.find((r) => r.status === 'pending');
  const myEntrant = permissions.entrantId;
  const checkedIn = match.checkedIn.includes(myEntrant);

  return (
    <div className="flex flex-col gap-4">
      {match.status === 'checkin' && (
        <Panel title={c.detail.checkin}>
          {permissions.canCheckIn ? (
            <div>
              <Button
                size="lg"
                disabled={busy}
                onClick={() => void run(() => checkIn(match.id), p.checkinDone)}
              >
                {p.checkinButton}
              </Button>
            </div>
          ) : (
            checkedIn && <p className="text-sm text-success">{p.checkedIn}</p>
          )}
        </Panel>
      )}

      {permissions.canReport && (
        <Panel title={p.report.title}>
          <p className="text-sm text-text-muted">{p.report.hint}</p>
          <GamesInput format={match.seriesFormat} names={names} value={games} onChange={setGames} />
          <Uploader
            label={p.report.evidence}
            hint={p.report.evidenceHint}
            accept={IMAGE_UPLOAD.mimeTypes}
            maxBytes={5 * 1024 * 1024}
            previewUrl={null}
            fallback="IMG"
            shape="square"
            labels={{
              choose: messages.profile.photo.choose,
              uploading: messages.profile.photo.uploading,
              tooLarge: messages.profile.photo.tooLarge,
              invalidType: messages.profile.photo.invalidType,
            }}
            onSelect={async (file) => {
              const form = new FormData();
              form.append('file', file);
              const result = await uploadEvidence(match.id, form);
              if (result.ok) {
                setEvidence((list) => [...list, result.data.path].slice(-5));
                toast.success(p.report.evidenceUploaded);
              } else {
                toast.error(result.message);
              }
            }}
          />
          <div>
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void reportResult(match.id, { games, evidencePaths: evidence }).then((result) => {
                  setBusy(false);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  const status = result.data.status;
                  toast.success(
                    status === 'completed'
                      ? p.report.confirmed
                      : status === 'disputed'
                        ? p.report.disputed
                        : p.report.sent,
                  );
                  setEvidence([]);
                  router.refresh();
                });
              }}
            >
              {p.report.submit}
            </Button>
          </div>
        </Panel>
      )}

      {permissions.canDispute && (
        <Panel title={p.dispute.title}>
          {match.disputeDeadline && (
            <p className="text-sm text-text-muted">
              {format(p.dispute.hint, { date: formatDateTime(match.disputeDeadline, tz) })}
            </p>
          )}
          <SelectField
            label={p.dispute.category}
            value={category}
            onChange={(value) => {
              if (value) setCategory(value);
            }}
            options={categoryOptions}
            placeholder={p.dispute.category}
          />
          <Field label={p.dispute.description}>
            {(control) => (
              <Textarea
                {...control}
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
              />
            )}
          </Field>
          <div>
            <Button
              variant="secondary"
              disabled={busy || description.trim().length < 10}
              onClick={() =>
                void run(
                  () => openDispute(match.id, { category, description }),
                  p.dispute.opened,
                ).then((ok) => {
                  if (ok) setDescription('');
                })
              }
            >
              {p.dispute.submit}
            </Button>
          </div>
        </Panel>
      )}

      {openDisputeHere && (
        <Panel title={p.dispute.evidenceTitle}>
          <FormField
            label={p.dispute.note}
            value={note}
            maxLength={1000}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <FormField
            label={p.dispute.url}
            type="url"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
            }}
          />
          <div>
            <Button
              variant="secondary"
              disabled={busy || (note.trim() === '' && link.trim() === '')}
              onClick={() =>
                void run(
                  () =>
                    addDisputeEvidence(openDisputeHere.id, {
                      note: note.trim() === '' ? null : note.trim(),
                      url: link.trim() === '' ? null : link.trim(),
                      path: null,
                    }),
                  p.dispute.evidenceAdded,
                ).then((ok) => {
                  if (ok) {
                    setNote('');
                    setLink('');
                  }
                })
              }
            >
              {p.dispute.addEvidence}
            </Button>
          </div>
        </Panel>
      )}

      {permissions.canRespondReschedule && pendingReschedule && (
        <Panel title={p.reschedule.respondTitle}>
          {pendingReschedule.reason && (
            <p className="text-sm text-text-muted">{pendingReschedule.reason}</p>
          )}
          <ul className="flex flex-col gap-2">
            {pendingReschedule.proposedAt.map((at) => (
              <li key={at} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-text">{formatDateTime(at, tz)}</span>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        respondReschedule(pendingReschedule.id, {
                          decision: 'accept',
                          chosenAt: at,
                        }),
                      p.reschedule.accepted,
                    )
                  }
                >
                  {p.reschedule.accept}
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    respondReschedule(pendingReschedule.id, { decision: 'reject', chosenAt: null }),
                  p.reschedule.rejected,
                )
              }
            >
              {p.reschedule.reject}
            </Button>
          </div>
        </Panel>
      )}

      {match.reschedules
        .filter((r) => r.status === 'pending' || r.status === 'accepted')
        .map((r) => (
          <p key={r.id} className="text-sm text-text-muted">
            {c.rescheduleStatuses[r.status]}
            {r.chosenAt ? ` · ${formatDateTime(r.chosenAt, tz)}` : ''}
          </p>
        ))}

      {permissions.canRequestReschedule && (
        <Panel title={p.reschedule.title}>
          <p className="text-sm text-text-muted">{p.reschedule.hint}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {options.map((value, i) => (
              <FormField
                key={String(i)}
                label={format(p.reschedule.option, { n: i + 1 })}
                type="datetime-local"
                value={value}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
              />
            ))}
          </div>
          <FormField
            label={p.reschedule.reason}
            value={reason}
            maxLength={500}
            onChange={(e) => {
              setReason(e.target.value);
            }}
          />
          <div>
            <Button
              variant="secondary"
              disabled={busy || options.every((o) => o === '')}
              onClick={() => {
                const proposedAt = options.flatMap((o) => {
                  const iso = fromZonedInput(o, tz);
                  return iso ? [iso] : [];
                });
                void run(
                  () =>
                    requestReschedule(match.id, {
                      proposedAt,
                      reason: reason.trim() === '' ? null : reason.trim(),
                    }),
                  p.reschedule.sent,
                ).then((ok) => {
                  if (ok) setOptions(['', '', '']);
                });
              }}
            >
              {p.reschedule.submit}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
