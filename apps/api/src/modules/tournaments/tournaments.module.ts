import { randomUUID } from 'node:crypto';

import { createFormatRegistry } from '@league/core';
import { Module, type Provider } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { IMAGE_STORAGE, type ImageStorage } from '../../shared/storage/image-storage.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TOURNAMENTS_DEPS, type TournamentsDeps } from './application/deps.js';
import * as UseCases from './application/tournaments.use-cases.js';
import {
  SupabaseTemplateRepository,
  SupabaseTournamentRepository,
} from './infrastructure/supabase-tournament-repository.js';
import {
  AdminTemplatesController,
  AdminTournamentsController,
} from './presentation/admin-tournaments.controller.js';

/** Every use case takes the same dependency bundle. */
const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [TOURNAMENTS_DEPS],
  useFactory: (deps: TournamentsDeps) => new UseCase(deps),
}));

@Module({
  imports: [IdentityModule],
  controllers: [AdminTournamentsController, AdminTemplatesController],
  providers: [
    {
      provide: TOURNAMENTS_DEPS,
      inject: [SUPABASE_ADMIN, ProfileQueries, CURRENT_ORGANIZATION, IMAGE_STORAGE, CLOCK],
      useFactory: (
        db: AdminClient,
        profiles: ProfileQueries,
        organization: CurrentOrganization,
        storage: ImageStorage,
        clock: Clock,
      ): TournamentsDeps => ({
        tournaments: new SupabaseTournamentRepository(db),
        templates: new SupabaseTemplateRepository(db),
        staff: profiles,
        organization,
        storage,
        clock,
        formats: createFormatRegistry(),
        newId: randomUUID,
      }),
    },
    ...useCaseProviders,
  ],
  exports: [UseCases.TournamentQueries],
})
export class TournamentsModule {}
