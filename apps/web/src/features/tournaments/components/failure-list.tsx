import type { EligibilityFailure, RosterViolation } from '@league/contracts';
import { format } from '@league/i18n';
import { CircleAlertIcon } from 'lucide-react';

import { messages } from '@/config/i18n';

import { failureReason } from '../format';

const t = messages.tournaments;

export interface FailureListProps {
  failures: readonly EligibilityFailure[];
  violations?: readonly RosterViolation[];
  blockers?: readonly string[];
  /** Display name per user id; the viewer's own id reads as "Tú". */
  names: ReadonlyMap<string, string>;
}

/** Why a registration cannot go through: blockers, roster rules and eligibility per player. */
export function FailureList({ failures, violations = [], blockers = [], names }: FailureListProps) {
  const items = [
    ...blockers.map(
      (code) => (t.blockers as Readonly<Record<string, string>>)[code] ?? messages.errors.unknown,
    ),
    ...violations.map((v) =>
      format(
        (t.rosterViolations as Readonly<Record<string, string>>)[v.reason] ??
          messages.errors.unknown,
        Object.fromEntries(
          Object.entries(v.details).filter(
            (entry): entry is [string, string | number] =>
              typeof entry[1] === 'string' || typeof entry[1] === 'number',
          ),
        ),
      ),
    ),
    ...failures.map((f) =>
      f.userId
        ? format(t.portal.register_page.playerFailure, {
            player: names.get(f.userId) ?? '—',
            reason: failureReason(f),
          })
        : format(t.portal.register_page.team, { reason: failureReason(f) }),
    ),
  ];
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((item, index) => (
        <li key={`${String(index)}-${item}`} className="flex items-start gap-2 text-danger">
          <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
