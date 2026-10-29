import { DataDragonChampionCatalog, StaticChampionCatalog } from '@league/integrations';
import { Module, type Provider } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TeamQueries } from '../teams/application/teams.use-cases.js';
import { TeamsModule } from '../teams/teams.module.js';
import { STATS_DEPS, type StatsDeps } from './application/deps.js';
import * as UseCases from './application/stats.use-cases.js';
import { StatsWorker } from './infrastructure/stats-worker.js';
import {
  SupabaseFollowRepository,
  SupabaseStatsRepository,
} from './infrastructure/supabase-stats-repository.js';
import {
  AdminStatsController,
  FollowsController,
  PublicStatsController,
} from './presentation/stats.controller.js';

/** Every use case takes the same dependency bundle. */
const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [STATS_DEPS],
  useFactory: (deps: StatsDeps) => new UseCase(deps),
}));

@Module({
  imports: [IdentityModule, TeamsModule],
  controllers: [PublicStatsController, FollowsController, AdminStatsController],
  providers: [
    {
      provide: STATS_DEPS,
      inject: [SUPABASE_ADMIN, ProfileQueries, TeamQueries, CURRENT_ORGANIZATION, CLOCK, ENV],
      useFactory: (
        db: AdminClient,
        profiles: ProfileQueries,
        teams: TeamQueries,
        organization: CurrentOrganization,
        clock: Clock,
        env: Env,
      ): StatsDeps => ({
        stats: new SupabaseStatsRepository(db),
        follows: new SupabaseFollowRepository(db),
        champions:
          env.CHAMPIONS_PROVIDER === 'static'
            ? new StaticChampionCatalog()
            : new DataDragonChampionCatalog(),
        profiles,
        teams,
        organization,
        clock,
        settings: { batchSize: 10 },
      }),
    },
    ...useCaseProviders,
    StatsWorker,
  ],
  exports: [...Object.values(UseCases)],
})
export class StatsModule {}
