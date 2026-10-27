// Shared fixture of the competition tests: a tournament with four seeded
// registrations (each managed by its own captain) on the in-memory doubles.
import {
  DEFAULT_TOURNAMENT_CONFIG,
  defaultPhase,
  type PhaseConfig,
  type TournamentConfig,
  type TournamentStatus,
} from '@league/contracts';
import { createFormatRegistry } from '@league/core';

import { FakeImageStorage } from '../../identity/testing/fake-image-storage.js';
import type { TournamentsDeps } from '../../tournaments/application/deps.js';
import { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';
import { phaseRows } from '../../tournaments/domain/tournament.js';
import {
  InMemoryTemplateRepository,
  InMemoryTournamentRepository,
} from '../../tournaments/testing/in-memory-tournament-repository.js';
import type { MatchesDeps } from '../application/deps.js';
import { FakeEvidenceStorage, InMemoryMatchRepository } from './in-memory-match-repository.js';

export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ADMIN = id(900);
export const STRANGER = id(901);
export const TOURNAMENT = id(500);
/** Four registrations, each managed by its own captain (captain = entrant id + 100). */
export const ENTRANTS = [id(1), id(2), id(3), id(4)];
export const captainOf = (entrant: string) => id(Number(entrant.slice(-3)) + 100);

export function setup(
  phases: PhaseConfig[] = [defaultPhase('single_elimination', 'Eliminación')],
  {
    status = 'registration_closed',
    seeded = true,
  }: { status?: TournamentStatus; seeded?: boolean } = {},
) {
  let now = new Date('2026-11-14T18:00:00.000Z');
  const tournamentRepo = new InMemoryTournamentRepository(() => now);
  const config: TournamentConfig = {
    ...DEFAULT_TOURNAMENT_CONFIG,
    capacity: { capacity: 8, waitlistEnabled: true },
    format: { seedingMethod: 'manual', phases },
  };
  tournamentRepo.tournaments.push({
    id: TOURNAMENT,
    organizationId: 'org',
    slug: 'relampago',
    status,
    config,
    templateId: null,
    coverPath: null,
    currentRulebookVersionId: null,
    publishedAt: now,
    createdAt: now,
  });
  // Publishing creates the phases (and groups) from the config.
  void tournamentRepo.update(TOURNAMENT, ADMIN, {
    config,
    phases: phaseRows(config),
    audit: null,
    event: null,
  });
  const tournamentsDeps: TournamentsDeps = {
    tournaments: tournamentRepo,
    templates: new InMemoryTemplateRepository(),
    staff: {
      isStaff: (u) => Promise.resolve(u === ADMIN),
      summaries: () => Promise.resolve(new Map()),
    },
    organization: { id: () => Promise.resolve('org') },
    storage: new FakeImageStorage(),
    clock: { now: () => now },
    formats: createFormatRegistry(),
    newId: () => 'x',
  };
  const matches = new InMemoryMatchRepository(() => now, tournamentRepo);
  let seq = 0;
  const deps: MatchesDeps = {
    matches,
    evidence: new FakeEvidenceStorage(),
    tournaments: new TournamentQueries(tournamentsDeps),
    entrants: {
      entrantsOf: () =>
        Promise.resolve(
          ENTRANTS.map((e, i) => ({
            id: e,
            status: 'approved' as const,
            displayName: `Equipo ${String(i + 1)}`,
            displayTag: `E${String(i + 1)}`,
            logoUrl: null,
            teamId: null,
            teamSlug: null,
            seed: seeded ? i + 1 : null,
          })),
        ),
      managedBy: (userId) =>
        Promise.resolve(new Set(ENTRANTS.filter((e) => captainOf(e) === userId))),
      entrantsOfUser: (userId) =>
        Promise.resolve(
          ENTRANTS.filter((e) => captainOf(e) === userId).map((entrantId) => ({
            entrantId,
            tournamentId: TOURNAMENT,
          })),
        ),
    },
    clock: { now: () => now },
    formats: createFormatRegistry(),
    newId: () => {
      seq += 1;
      return `00000000-0000-4000-f000-${String(seq).padStart(12, '0')}`;
    },
  };
  return {
    deps,
    matches,
    tournamentRepo,
    advance: (minutes: number) => {
      now = new Date(now.getTime() + minutes * 60_000);
    },
  };
}
