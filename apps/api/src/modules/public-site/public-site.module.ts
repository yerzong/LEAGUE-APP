import { Module } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { RiotAccountQueries } from '../riot-accounts/application/riot-verification.use-cases.js';
import { RiotAccountsModule } from '../riot-accounts/riot-accounts.module.js';
import { TeamQueries } from '../teams/application/teams.use-cases.js';
import { TeamsModule } from '../teams/teams.module.js';
import { RegistrationQueries } from '../registrations/application/registrations.use-cases.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { TournamentQueries } from '../tournaments/application/tournaments.use-cases.js';
import { TournamentsModule } from '../tournaments/tournaments.module.js';
import {
  GetPublicPlayerUseCase,
  GetPublicTeamUseCase,
  ListPublicPlayersUseCase,
  ListPublicTeamsUseCase,
  PUBLIC_PAGES_DEPS,
  type PublicPagesDeps,
} from './application/public-pages.js';
import {
  GetPublicTournamentUseCase,
  ListPublicTournamentsUseCase,
  PUBLIC_TOURNAMENTS_DEPS,
  type PublicTournamentsDeps,
} from './application/public-tournaments.js';
import { PublicTournamentsController } from './presentation/public-tournaments.controller.js';
import { PublicController } from './presentation/public.controller.js';

/** Read-only composition of identity, riot-accounts, teams and tournaments for the public site. */
@Module({
  imports: [
    IdentityModule,
    RiotAccountsModule,
    TeamsModule,
    TournamentsModule,
    RegistrationsModule,
  ],
  controllers: [PublicController, PublicTournamentsController],
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
      provide: PUBLIC_TOURNAMENTS_DEPS,
      inject: [TournamentQueries, RegistrationQueries],
      useFactory: (
        tournaments: TournamentQueries,
        registrations: RegistrationQueries,
      ): PublicTournamentsDeps => ({ tournaments, registrations }),
    },
    {
      provide: ListPublicTournamentsUseCase,
      inject: [PUBLIC_TOURNAMENTS_DEPS],
      useFactory: (d: PublicTournamentsDeps) => new ListPublicTournamentsUseCase(d),
    },
    {
      provide: GetPublicTournamentUseCase,
      inject: [PUBLIC_TOURNAMENTS_DEPS],
      useFactory: (d: PublicTournamentsDeps) => new GetPublicTournamentUseCase(d),
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
    {
      provide: ListPublicTeamsUseCase,
      inject: [PUBLIC_PAGES_DEPS],
      useFactory: (d: PublicPagesDeps) => new ListPublicTeamsUseCase(d),
    },
    {
      provide: ListPublicPlayersUseCase,
      inject: [PUBLIC_PAGES_DEPS],
      useFactory: (d: PublicPagesDeps) => new ListPublicPlayersUseCase(d),
    },
  ],
  exports: [GetPublicPlayerUseCase, GetPublicTeamUseCase],
})
export class PublicSiteModule {}
