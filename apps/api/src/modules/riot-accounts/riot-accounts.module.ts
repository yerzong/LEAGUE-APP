import {
  BASE_ICON_COUNT,
  RiotApiAccountAdapter,
  StubRiotAccountAdapter,
  type RiotAccountPort,
} from '@league/integrations';
import { Module } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import {
  ICON_PICKER,
  RIOT_ACCOUNT_PORT,
  RIOT_ACCOUNT_REPOSITORY,
  type RiotAccountRepository,
} from './application/ports.js';
import {
  ConfirmRiotVerificationUseCase,
  GetMyRiotAccountUseCase,
  RiotAccountQueries,
  StartRiotVerificationUseCase,
  UnlinkRiotAccountUseCase,
} from './application/riot-verification.use-cases.js';
import { NextIconPicker, RandomIconPicker, type IconPicker } from './domain/riot-account.js';
import { SupabaseRiotAccountRepository } from './infrastructure/supabase-riot-account-repository.js';
import { RiotAccountController } from './presentation/riot-account.controller.js';

@Module({
  controllers: [RiotAccountController],
  providers: [
    {
      provide: RIOT_ACCOUNT_REPOSITORY,
      inject: [SUPABASE_ADMIN],
      useFactory: (db: AdminClient) => new SupabaseRiotAccountRepository(db),
    },
    {
      provide: RIOT_ACCOUNT_PORT,
      inject: [ENV],
      useFactory: (env: Env): RiotAccountPort =>
        env.RIOT_PROVIDER === 'riot' && env.RIOT_API_KEY
          ? new RiotApiAccountAdapter({ apiKey: env.RIOT_API_KEY })
          : new StubRiotAccountAdapter({ generateAccounts: true }),
    },
    {
      provide: ICON_PICKER,
      inject: [ENV],
      useFactory: (env: Env): IconPicker =>
        env.RIOT_PROVIDER === 'riot'
          ? new RandomIconPicker(BASE_ICON_COUNT)
          : new NextIconPicker(BASE_ICON_COUNT),
    },
    {
      provide: StartRiotVerificationUseCase,
      inject: [RIOT_ACCOUNT_REPOSITORY, RIOT_ACCOUNT_PORT, ICON_PICKER, CLOCK],
      useFactory: (
        repo: RiotAccountRepository,
        riot: RiotAccountPort,
        icons: IconPicker,
        clock: Clock,
      ) => new StartRiotVerificationUseCase(repo, riot, icons, clock),
    },
    {
      provide: ConfirmRiotVerificationUseCase,
      inject: [RIOT_ACCOUNT_REPOSITORY, RIOT_ACCOUNT_PORT, CLOCK],
      useFactory: (repo: RiotAccountRepository, riot: RiotAccountPort, clock: Clock) =>
        new ConfirmRiotVerificationUseCase(repo, riot, clock),
    },
    {
      provide: GetMyRiotAccountUseCase,
      inject: [RIOT_ACCOUNT_REPOSITORY, CLOCK],
      useFactory: (repo: RiotAccountRepository, clock: Clock) =>
        new GetMyRiotAccountUseCase(repo, clock),
    },
    {
      provide: UnlinkRiotAccountUseCase,
      inject: [RIOT_ACCOUNT_REPOSITORY],
      useFactory: (repo: RiotAccountRepository) => new UnlinkRiotAccountUseCase(repo),
    },
    {
      provide: RiotAccountQueries,
      inject: [RIOT_ACCOUNT_REPOSITORY],
      useFactory: (repo: RiotAccountRepository) => new RiotAccountQueries(repo),
    },
  ],
  exports: [RiotAccountQueries],
})
export class RiotAccountsModule {}
