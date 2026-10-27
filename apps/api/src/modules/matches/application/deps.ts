import type { PhaseFormatRegistry } from '@league/core';

import type { Clock } from '../../../shared/clock.js';
import type { RegistrationQueries } from '../../registrations/application/registrations.use-cases.js';
import type { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';
import type { EvidenceStorage, MatchRepository } from './ports.js';

/** Everything the match use cases depend on (one provider in MatchesModule). */
export interface MatchesDeps {
  readonly matches: MatchRepository;
  readonly evidence: EvidenceStorage;
  readonly tournaments: Pick<TournamentQueries, 'findById' | 'findBySlug' | 'phases' | 'isStaff'>;
  readonly entrants: Pick<RegistrationQueries, 'entrantsOf' | 'managedBy' | 'entrantsOfUser'>;
  readonly clock: Clock;
  readonly formats: PhaseFormatRegistry;
  readonly newId: () => string;
}

export const MATCHES_DEPS = Symbol('MatchesDeps');
