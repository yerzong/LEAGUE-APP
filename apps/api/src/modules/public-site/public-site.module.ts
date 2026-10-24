import { Module } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { RiotAccountQueries } from '../riot-accounts/application/riot-verification.use-cases.js';
import { RiotAccountsModule } from '../riot-accounts/riot-accounts.module.js';
import { TeamQueries } from '../teams/application/teams.use-cases.js';
import { TeamsModule } from '../teams/teams.module.js';
import {
  GetPublicPlayerUseCase,
  GetPublicTeamUseCase,
  PUBLIC_PAGES_DEPS,
  type PublicPagesDeps,
} from './application/public-pages.js';
import { PublicController } from './presentation/public.controller.js';

/** Read-only composition of identity, riot-accounts and teams for the public site. */
@Module({
  imports: [IdentityModule, RiotAccountsModule, TeamsModule],
  controllers: [PublicController],
  providers: [
    {
      provide: PUBLIC_PAGES_DEPS,
      inject: [TeamQueries, ProfileQueries, RiotAccountQueries, CLOCK],
      useFactory: (
        teams: TeamQueries,
        profiles: ProfileQueries,
        riot: RiotAccountQueries,
        clock: Clock,
      ): PublicPagesDeps => ({
        teams,
        profiles,
        riot,
        clock,
      }),
    },
    {
      provide: GetPublicTeamUseCase,
      inject: [PUBLIC_PAGES_DEPS],
      useFactory: (d: PublicPagesDeps) => new GetPublicTeamUseCase(d),
    },
    {
      provide: GetPublicPlayerUseCase,
      inject: [PUBLIC_PAGES_DEPS],
      useFactory: (d: PublicPagesDeps) => new GetPublicPlayerUseCase(d),
    },
  ],
})
export class PublicSiteModule {}
