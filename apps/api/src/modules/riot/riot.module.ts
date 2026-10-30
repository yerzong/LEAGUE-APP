import {
  RiotStubTournamentAdapter,
  RiotTournamentAdapter,
  type MatchDataPort,
  type TournamentProviderPort,
} from '@league/integrations';
import { Module, type Provider } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { IdentityModule } from '../identity/identity.module.js';
import { MATCHES_DEPS, type MatchesDeps } from '../matches/application/deps.js';
import { MatchesModule } from '../matches/matches.module.js';
import { TournamentQueries } from '../tournaments/application/tournaments.use-cases.js';
import { TournamentsModule } from '../tournaments/tournaments.module.js';
import { RIOT_DEPS, type RiotDeps } from './application/deps.js';
import * as UseCases from './application/riot.use-cases.js';
import { RIOT_REPOSITORY, type RiotRepository } from './application/ports.js';
import { SupabaseRiotRepository } from './infrastructure/supabase-riot-repository.js';
import {
  AdminRiotController,
  PlayerRiotController,
  RiotWebhookController,
} from './presentation/riot.controller.js';

/** The Tournament-V5/Match-V5 adapter for the configured provider (shared instance). */
export const RIOT_TOURNAMENT_API = Symbol('RiotTournamentApi');

const USE_CASES = [
  UseCases.ConnectRiotUseCase,
  UseCases.GenerateCodeUseCase,
  UseCases.ProcessRiotCallbackUseCase,
  UseCases.GetRiotStatusUseCase,
  UseCases.GetMatchCodesUseCase,
  UseCases.GetMyMatchCodesUseCase,
] as const;

const useCaseProviders: Provider[] = USE_CASES.map((UseCase) => ({
  provide: UseCase,
  inject: [RIOT_DEPS],
  useFactory: (deps: RiotDeps) => new UseCase(deps),
}));

@Module({
  imports: [IdentityModule, MatchesModule, TournamentsModule],
  controllers: [RiotWebhookController, AdminRiotController, PlayerRiotController],
  providers: [
    {
      provide: RIOT_REPOSITORY,
      inject: [SUPABASE_ADMIN],
      useFactory: (db: AdminClient) => new SupabaseRiotRepository(db),
    },
    {
      // Real Tournament-V5 with a key; the Tournament-Stub otherwise; null in manual.
      provide: RIOT_TOURNAMENT_API,
      inject: [ENV],
      useFactory: (env: Env): (TournamentProviderPort & MatchDataPort) | null => {
        if (env.RIOT_PROVIDER === 'manual') return null;
        if (env.RIOT_PROVIDER === 'riot' && env.RIOT_API_KEY)
          return new RiotTournamentAdapter({ apiKey: env.RIOT_API_KEY });
        return new RiotStubTournamentAdapter();
      },
    },
    {
      provide: RIOT_DEPS,
      inject: [
        RIOT_REPOSITORY,
        RIOT_TOURNAMENT_API,
        MATCHES_DEPS,
        TournamentQueries,
        CURRENT_ORGANIZATION,
        CLOCK,
        ENV,
      ],
      useFactory: (
        repo: RiotRepository,
        api: (TournamentProviderPort & MatchDataPort) | null,
        matches: MatchesDeps,
        tournaments: TournamentQueries,
        organization: CurrentOrganization,
        clock: Clock,
        env: Env,
      ): RiotDeps => ({
        repo,
        tournamentApi: api,
        matchData: api,
        matches,
        tournaments,
        organization,
        clock,
        settings: {
          provider: env.RIOT_PROVIDER,
          live: env.RIOT_PROVIDER === 'riot' && Boolean(env.RIOT_API_KEY),
          callbackUrl: env.RIOT_CALLBACK_URL ?? `${env.WEB_ORIGIN}/integrations/riot/callbacks`,
          region: 'la1',
        },
      }),
    },
    ...useCaseProviders,
  ],
})
export class RiotModule {}
