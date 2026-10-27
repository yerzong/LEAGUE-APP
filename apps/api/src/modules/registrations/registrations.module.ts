import { randomInt } from 'node:crypto';

import { Module, type Provider } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { RiotAccountQueries } from '../riot-accounts/application/riot-verification.use-cases.js';
import { RiotAccountsModule } from '../riot-accounts/riot-accounts.module.js';
import { TeamQueries } from '../teams/application/teams.use-cases.js';
import { TeamsModule } from '../teams/teams.module.js';
import { TournamentQueries } from '../tournaments/application/tournaments.use-cases.js';
import { TournamentsModule } from '../tournaments/tournaments.module.js';
import { REGISTRATIONS_DEPS, type RegistrationsDeps } from './application/deps.js';
import * as UseCases from './application/registrations.use-cases.js';
import { PlayerFactsAdapter } from './infrastructure/player-facts.js';
import { SupabaseRegistrationRepository } from './infrastructure/supabase-registration-repository.js';
import {
  AdminRegistrationsController,
  RegistrationsController,
} from './presentation/registrations.controller.js';

/** Every use case takes the same dependency bundle. */
const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [REGISTRATIONS_DEPS],
  useFactory: (deps: RegistrationsDeps) => new UseCase(deps),
}));

const RANDOM_RANGE = 2 ** 32;

@Module({
  imports: [IdentityModule, RiotAccountsModule, TeamsModule, TournamentsModule],
  controllers: [RegistrationsController, AdminRegistrationsController],
  providers: [
    {
      provide: REGISTRATIONS_DEPS,
      inject: [
        SUPABASE_ADMIN,
        TournamentQueries,
        TeamQueries,
        ProfileQueries,
        RiotAccountQueries,
        CLOCK,
      ],
      useFactory: (
        db: AdminClient,
        tournaments: TournamentQueries,
        teams: TeamQueries,
        profiles: ProfileQueries,
        riot: RiotAccountQueries,
        clock: Clock,
      ): RegistrationsDeps => ({
        registrations: new SupabaseRegistrationRepository(db),
        tournaments,
        teams,
        players: new PlayerFactsAdapter(profiles, riot),
        clock,
        // Seeding draws: unpredictable to registrants.
        random: () => randomInt(RANDOM_RANGE) / RANDOM_RANGE,
      }),
    },
    ...useCaseProviders,
  ],
  exports: [UseCases.RegistrationQueries],
})
export class RegistrationsModule {}
