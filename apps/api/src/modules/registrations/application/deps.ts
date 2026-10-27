import type { Clock } from '../../../shared/clock.js';
import type { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';
import type { PlayerFactsReader, RegistrationRepository, TeamDirectory } from './ports.js';

/** Everything the registration use cases depend on (one provider in RegistrationsModule). */
export interface RegistrationsDeps {
  readonly registrations: RegistrationRepository;
  readonly tournaments: Pick<
    TournamentQueries,
    | 'findById'
    | 'findBySlug'
    | 'list'
    | 'currentRulebook'
    | 'isStaff'
    | 'listItem'
    | 'publicDetail'
    | 'rulebookVersionNumbers'
  >;
  readonly teams: TeamDirectory;
  readonly players: PlayerFactsReader;
  readonly clock: Clock;
  /** Uniform in [0, 1): random seeding. */
  readonly random: () => number;
}

export const REGISTRATIONS_DEPS = Symbol('RegistrationsDeps');
