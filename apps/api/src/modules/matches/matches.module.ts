import { randomUUID } from 'node:crypto';

import { createFormatRegistry } from '@league/core';
import { Module, type Provider } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { RegistrationQueries } from '../registrations/application/registrations.use-cases.js';
import { RegistrationsModule } from '../registrations/registrations.module.js';
import { TournamentQueries } from '../tournaments/application/tournaments.use-cases.js';
import { TournamentsModule } from '../tournaments/tournaments.module.js';
import { MATCHES_DEPS, type MatchesDeps } from './application/deps.js';
import * as UseCases from './application/matches.use-cases.js';
import { CheckinSweeper } from './infrastructure/checkin-sweeper.js';
import {
  SupabaseEvidenceStorage,
  SupabaseMatchRepository,
} from './infrastructure/supabase-match-repository.js';
import {
  AdminMatchesController,
  MatchesController,
  PublicMatchesController,
} from './presentation/matches.controller.js';

/** Every use case takes the same dependency bundle. */
const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [MATCHES_DEPS],
  useFactory: (deps: MatchesDeps) => new UseCase(deps),
}));

@Module({
  imports: [TournamentsModule, RegistrationsModule],
  controllers: [MatchesController, AdminMatchesController, PublicMatchesController],
  providers: [
    {
      provide: MATCHES_DEPS,
      inject: [SUPABASE_ADMIN, TournamentQueries, RegistrationQueries, CLOCK],
      useFactory: (
        db: AdminClient,
        tournaments: TournamentQueries,
        entrants: RegistrationQueries,
        clock: Clock,
      ): MatchesDeps => ({
        matches: new SupabaseMatchRepository(db),
        evidence: new SupabaseEvidenceStorage(db),
        tournaments,
        entrants,
        clock,
        formats: createFormatRegistry(),
        newId: randomUUID,
      }),
    },
    ...useCaseProviders,
    CheckinSweeper,
  ],
  exports: [MATCHES_DEPS],
})
export class MatchesModule {}
