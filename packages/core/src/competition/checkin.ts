// Check-in (docs/13 §9): a window before the scheduled time; whoever is not
// checked in when it closes forfeits.

import type { EntrantId, IsoDate } from './time.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function checkinWindow(
  scheduledAt: IsoDate,
  opensMinutesBefore: number,
  closesMinutesBefore: number,
): { opensAt: IsoDate; closesAt: IsoDate } {
  const at = Date.parse(scheduledAt);
  return {
    opensAt: new Date(at - opensMinutesBefore * MINUTE).toISOString(),
    closesAt: new Date(at - closesMinutesBefore * MINUTE).toISOString(),
  };
}

export type CheckinOutcome =
  | { readonly kind: 'ready' }
  | { readonly kind: 'forfeit'; readonly loser: EntrantId; readonly winner: EntrantId }
  /** Nobody showed up: staff decides (rematch, double forfeit…). */
  | { readonly kind: 'no_show' };

/** What happens when the check-in window closes. */
export function checkinOutcome(
  entrantA: EntrantId,
  entrantB: EntrantId,
  checkedIn: readonly EntrantId[],
): CheckinOutcome {
  const a = checkedIn.includes(entrantA);
  const b = checkedIn.includes(entrantB);
  if (a && b) return { kind: 'ready' };
  if (a) return { kind: 'forfeit', loser: entrantB, winner: entrantA };
  if (b) return { kind: 'forfeit', loser: entrantA, winner: entrantB };
  return { kind: 'no_show' };
}

/** End of the window to dispute a confirmed result (docs/13 §8). */
export function disputeDeadline(finalizedAt: IsoDate, hours: number): IsoDate {
  return new Date(Date.parse(finalizedAt) + hours * HOUR).toISOString();
}
