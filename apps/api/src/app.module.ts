import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ENV, type Env } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/identity/auth.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { MatchesModule } from './modules/matches/matches.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PublicSiteModule } from './modules/public-site/public-site.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { StandingsModule } from './modules/standings/standings.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { RegistrationsModule } from './modules/registrations/registrations.module.js';
import { RiotAccountsModule } from './modules/riot-accounts/riot-accounts.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { TournamentsModule } from './modules/tournaments/tournaments.module.js';
import { ApplicationErrorFilter } from './shared/application-error.filter.js';
import { SharedModule } from './shared/shared.module.js';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        SharedModule,
        AuthModule,
        HealthModule,
        IdentityModule,
        RiotAccountsModule,
        TeamsModule,
        TournamentsModule,
        RegistrationsModule,
        MatchesModule,
        SchedulingModule,
        StandingsModule,
        StatsModule,
        PublicSiteModule,
        NotificationsModule,
      ],
      providers: [
        { provide: ENV, useValue: env },
        { provide: APP_FILTER, useClass: ApplicationErrorFilter },
      ],
      exports: [ENV],
    };
  }
}
