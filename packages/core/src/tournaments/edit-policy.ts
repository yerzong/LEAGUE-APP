// What can be edited after publishing (docs/14 §3.2). Each wizard section is
// free, needs a confirmation (and a notice to the registered entrants) or is
// locked, depending on the tournament status.

import { LockedSectionError } from '../errors.js';
import type { TournamentStatus } from '../lifecycle/tournament.js';

export const TOURNAMENT_SECTIONS = [
  'basics',
  'capacity',
  'participants',
  'game',
  'eligibility',
  'roster',
  'format',
  'schedule',
  'broadcast',
  'supervision',
  'communication',
  'prizes',
] as const;

export type TournamentSection = (typeof TOURNAMENT_SECTIONS)[number];
export type EditMode = 'free' | 'confirm' | 'locked';
export type EditPolicy = Readonly<Record<TournamentSection, EditMode>>;

const all = (mode: EditMode): EditPolicy =>
  Object.fromEntries(TOURNAMENT_SECTIONS.map((s) => [s, mode])) as Record<
    TournamentSection,
    EditMode
  >;

/** Texts, dates and capacity stay free; the rules registrants agreed to need confirmation. */
const BEFORE_START: EditPolicy = {
  ...all('confirm'),
  basics: 'free',
  capacity: 'free',
  schedule: 'free',
  broadcast: 'free',
  communication: 'free',
  prizes: 'free',
};

/** Texts and future schedules; future phases and supervision with confirmation. */
const IN_PROGRESS: EditPolicy = {
  ...all('locked'),
  basics: 'free',
  schedule: 'free',
  broadcast: 'free',
  communication: 'free',
  format: 'confirm',
  supervision: 'confirm',
  prizes: 'confirm',
};

const POLICIES: Readonly<Record<TournamentStatus, EditPolicy>> = {
  draft: all('free'),
  published: BEFORE_START,
  registration_open: BEFORE_START,
  registration_closed: BEFORE_START,
  seeding: BEFORE_START,
  in_progress: IN_PROGRESS,
  completed: all('locked'),
  canceled: all('locked'),
  archived: all('locked'),
};

export function editPolicy(status: TournamentStatus): EditPolicy {
  return POLICIES[status];
}

/** The changed sections that need confirmation. Throws `LockedSectionError` for a locked one. */
export function changesNeedingConfirmation(
  status: TournamentStatus,
  changed: readonly TournamentSection[],
): TournamentSection[] {
  const policy = editPolicy(status);
  const locked = changed.filter((s) => policy[s] === 'locked');
  if (locked.length > 0) {
    throw new LockedSectionError(`Sections locked while ${status}`, { status, sections: locked });
  }
  return changed.filter((s) => policy[s] === 'confirm');
}
