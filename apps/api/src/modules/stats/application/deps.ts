import type { Clock } from '../../../shared/clock.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type { ProfileQueries } from '../../identity/application/profile.use-cases.js';
import type { TeamQueries } from '../../teams/application/teams.use-cases.js';
import type { ChampionDirectory, FollowRepository, StatsRepository } from './ports.js';

/** Everything the stats use cases depend on (one provider in StatsModule). */
export interface StatsDeps {
  readonly stats: StatsRepository;
  readonly follows: FollowRepository;
  readonly champions: ChampionDirectory;
  readonly profiles: Pick<
    ProfileQueries,
    'findById' | 'findByUsername' | 'privacyOf' | 'summaries' | 'isStaff'
  >;
  readonly teams: Pick<TeamQueries, 'findById' | 'findBySlug' | 'activeMembers' | 'logoUrl'>;
  readonly organization: CurrentOrganization;
  readonly clock: Clock;
  readonly settings: { readonly batchSize: number };
}

export const STATS_DEPS = Symbol('StatsDeps');
