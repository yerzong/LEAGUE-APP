import type { MatchDataPort, TournamentProviderPort } from '@league/integrations';

import type { Clock } from '../../../shared/clock.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type { MatchesDeps } from '../../matches/application/deps.js';
import type { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';
import type { RiotRepository } from './ports.js';

/** Everything the Riot use cases depend on (one provider in RiotModule). */
export interface RiotDeps {
  readonly repo: RiotRepository;
  /** Null in manual mode (no Riot): code generation is unavailable. */
  readonly tournamentApi: TournamentProviderPort | null;
  readonly matchData: MatchDataPort | null;
  readonly matches: MatchesDeps;
  readonly tournaments: Pick<TournamentQueries, 'findById'>;
  readonly organization: CurrentOrganization;
  readonly clock: Clock;
  readonly settings: {
    readonly provider: 'riot' | 'stub' | 'manual';
    readonly live: boolean;
    readonly callbackUrl: string;
    readonly region: string;
  };
}

export const RIOT_DEPS = Symbol('RiotDeps');
