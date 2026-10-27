'use client';

import type { Registration, RegistrationDecision } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  toast,
} from '@league/ui';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { decideRegistration } from '../actions';
import { EntrantStatusBadge } from '../components/status-badges';
import { failureReason, formatDateTime } from '../format';

const t = messages.tournaments;
const r = t.tracking.registrations;

/** One registration with per-player eligibility and the staff decisions. */
export function RegistrationReview({
  registration,
  timeZone,
  canDecide,
}: {
  registration: Registration;
  timeZone: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const { eligibility } = registration;
  const teamFailures = eligibility.failures.filter((f) => f.userId === null);
  const name = registration.displayName;

  const decide = async (
    decision: RegistrationDecision,
    reason: string | null,
    override = false,
  ) => {
    const result = await decideRegistration(registration.id, {
      decision,
      reason,
      overrideEligibility: override,
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(
      decision === 'approve' ? r.approved : decision === 'reject' ? r.rejected : r.promoted,
    );
    router.refresh();
  };

  const reason = { label: t.reason.label, hint: t.reason.hint, placeholder: t.reason.placeholder };
  const pendingLike = registration.status === 'pending' || registration.status === 'waitlisted';

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar size="lg" className="rounded-md">
              {registration.logoUrl && (
                <AvatarImage src={registration.logoUrl} alt="" className="rounded-md" />
              )}
              <AvatarFallback className="rounded-md">
                {registration.displayTag ?? name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="font-display text-lg font-bold text-text">{name}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <EntrantStatusBadge status={registration.status} />
                <Badge variant={eligibility.eligible ? 'success' : 'danger'}>
                  {eligibility.eligible ? r.eligible : r.notEligible}
                </Badge>
                {registration.paymentStatus === 'pending' && (
                  <Badge variant="warning">{r.paymentPending}</Badge>
                )}
              </span>
              <span className="text-xs text-text-muted">
                {format(r.registeredAt, {
                  date: formatDateTime(registration.registeredAt, timeZone),
                })}
                {registration.rulebookVersion !== null &&
                  ` · ${format(r.rulebookVersion, { version: registration.rulebookVersion })}`}
                {registration.waitlistPosition !== null &&
                  ` · ${format(r.waitlistPosition, { position: registration.waitlistPosition })}`}
              </span>
            </div>
          </div>
          {canDecide && (
            <div className="flex flex-wrap gap-2">
              {pendingLike && (
                <ConfirmDialog
                  trigger={<Button size="sm">{r.approve}</Button>}
                  title={eligibility.eligible ? format(r.approveTitle, { name }) : r.exceptionTitle}
                  description={
                    eligibility.eligible
                      ? r.approveDescription
                      : format(r.exceptionDescription, { name })
                  }
                  confirmLabel={r.approve}
                  cancelLabel={messages.common.cancel}
                  reason={eligibility.eligible ? undefined : reason}
                  onConfirm={(text) => decide('approve', text, !eligibility.eligible)}
                />
              )}
              {registration.status === 'waitlisted' && (
                <Button size="sm" variant="secondary" onClick={() => void decide('promote', null)}>
                  {r.promote}
                </Button>
              )}
              {pendingLike && (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="secondary">
                      {r.reject}
                    </Button>
                  }
                  title={format(r.rejectTitle, { name })}
                  description={r.rejectDescription}
                  confirmLabel={r.reject}
                  cancelLabel={messages.common.cancel}
                  destructive
                  reason={reason}
                  onConfirm={(text) => decide('reject', text)}
                />
              )}
            </div>
          )}
        </div>
        {registration.rejectionReason && (
          <p className="text-sm text-text-muted">
            {format(r.rejectionReason, { reason: registration.rejectionReason })}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-text-muted caps">
              <tr>
                <th className="py-1 pr-3 font-normal">{r.rosterColumns.player}</th>
                <th className="py-1 pr-3 font-normal">{r.rosterColumns.role}</th>
                <th className="py-1 pr-3 font-normal">{r.rosterColumns.riotId}</th>
                <th className="py-1 font-normal">{r.rosterColumns.eligibility}</th>
              </tr>
            </thead>
            <tbody>
              {registration.roster.map((member) => {
                const failures = eligibility.failures.filter((f) => f.userId === member.userId);
                const label = member.displayName ?? member.username ?? '—';
                return (
                  <tr key={member.userId} className="border-t border-border align-top">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <Avatar size="sm">
                          {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
                          <AvatarFallback>{label.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-text">{label}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {t.options.rosterRoles[member.role]}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{member.riotId ?? '—'}</td>
                    <td className="py-2">
                      {failures.length === 0 ? (
                        <span className="flex items-center gap-1 text-success">
                          <CircleCheckIcon aria-hidden className="size-4" /> {r.playerOk}
                        </span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {failures.map((f) => (
                            <li
                              key={`${f.rule}-${f.reason}`}
                              className="flex items-start gap-1 text-danger"
                            >
                              <CircleXIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                              {failureReason(f)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {teamFailures.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-danger">
            {teamFailures.map((f) => (
              <li key={`${f.rule}-${f.reason}`} className="flex items-start gap-1">
                <CircleXIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                {r.teamFailure}: {failureReason(f)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
