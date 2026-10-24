import { randomBytes, randomUUID } from 'node:crypto';

import { Module, type Provider } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { IMAGE_STORAGE, type ImageStorage } from '../../shared/storage/image-storage.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { RiotAccountQueries } from '../riot-accounts/application/riot-verification.use-cases.js';
import { RiotAccountsModule } from '../riot-accounts/riot-accounts.module.js';
import { TEAMS_DEPS, type TeamsDeps } from './application/deps.js';
import * as UseCases from './application/teams.use-cases.js';
import {
  SupabaseFreeAgentRepository,
  SupabaseTeamRepository,
} from './infrastructure/supabase-team-repository.js';
import {
  FreeAgentController,
  InvitationsController,
  TeamsController,
} from './presentation/teams.controller.js';

/** Every use case takes the same dependency bundle. */
const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [TEAMS_DEPS],
  useFactory: (deps: TeamsDeps) => new UseCase(deps),
}));

@Module({
  imports: [IdentityModule, RiotAccountsModule],
  controllers: [TeamsController, InvitationsController, FreeAgentController],
  providers: [
    {
      provide: TEAMS_DEPS,
      inject: [
        SUPABASE_ADMIN,
        ProfileQueries,
        RiotAccountQueries,
        CURRENT_ORGANIZATION,
        IMAGE_STORAGE,
        CLOCK,
      ],
      useFactory: (
        db: AdminClient,
        users: ProfileQueries,
        riot: RiotAccountQueries,
        organization: CurrentOrganization,
        storage: ImageStorage,
        clock: Clock,
      ): TeamsDeps => ({
        teams: new SupabaseTeamRepository(db),
        freeAgents: new SupabaseFreeAgentRepository(db),
        users,
        riot,
        organization,
        storage,
        clock,
        // 24 random bytes: unguessable link invitations.
        newCode: () => randomBytes(24).toString('base64url'),
        newId: randomUUID,
      }),
    },
    ...useCaseProviders,
  ],
  exports: [UseCases.TeamQueries],
})
export class TeamsModule {}
