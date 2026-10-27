import type { EntrantStatus, PlayerRole, RosterRole } from '@league/contracts';

export interface RosterRecord {
  readonly userId: string;
  readonly riotAccountId: string | null;
  readonly role: RosterRole;
  readonly gameRole: PlayerRole | null;
  readonly exclusivityKey: string | null;
}

export interface EntrantRecord {
  readonly id: string;
  readonly tournamentId: string;
  readonly teamId: string | null;
  readonly userId: string | null;
  readonly displayName: string;
  readonly displayTag: string | null;
  readonly logoPath: string | null;
  readonly status: EntrantStatus;
  readonly seed: number | null;
  readonly waitlistPosition: number | null;
  readonly rejectionReason: string | null;
  readonly rulebookVersionId: string | null;
  readonly registeredBy: string;
  readonly createdAt: Date;
  /** Active roster (members not removed). */
  readonly roster: readonly RosterRecord[];
}

/** A registration still taking part (or waiting to): it holds its roster and exclusivity. */
export const ACTIVE_STATUSES: readonly EntrantStatus[] = ['pending', 'approved', 'waitlisted'];

/** Tournament statuses in which staff decides on registrations and captains withdraw. */
export const OPEN_FOR_DECISIONS = [
  'published',
  'registration_open',
  'registration_closed',
] as const;

/**
 * Failure details that are personal data of a teammate (their age, when they
 * declared their gender): the captain sees the reason and the tournament
 * limits only; staff sees everything.
 */
export const PERSONAL_DETAILS: Readonly<Record<string, readonly string[]>> = {
  age_min: ['age'],
  gender: ['declaredAt'],
};
