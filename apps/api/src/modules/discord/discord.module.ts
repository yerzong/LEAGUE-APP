import {
  DEFAULT_BRAND_COLOR,
  DiscordRestAdapter,
  FakeDiscordAdapter,
  type DiscordPort,
  type EmbedTheme,
} from '@league/integrations';
import { Module, type Provider } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { MATCHES_DEPS, type MatchesDeps } from '../matches/application/deps.js';
import { CheckInUseCase, ListMyMatchesUseCase } from '../matches/application/matches.use-cases.js';
import { MatchesModule } from '../matches/matches.module.js';
import {
  GetPublicPlayerUseCase,
  GetPublicTeamUseCase,
} from '../public-site/application/public-pages.js';
import { PublicSiteModule } from '../public-site/public-site.module.js';
import { GetPublicBoardUseCase } from '../standings/application/standings.use-cases.js';
import { TournamentQueries } from '../tournaments/application/tournaments.use-cases.js';
import { TournamentsModule } from '../tournaments/tournaments.module.js';
import { DISCORD_DEPS, type DiscordDeps } from './application/deps.js';
import * as UseCases from './application/discord.use-cases.js';
import { DiscordChannelAdapter } from './infrastructure/discord-channel.js';
import { DiscordWorker } from './infrastructure/discord-worker.js';
import { SupabaseDiscordDirectory } from './infrastructure/supabase-discord-directory.js';
import { AdminDiscordController, BotController } from './presentation/discord.controller.js';

/** The Discord delivery channel the notification engine queues (see NotificationsModule). */
export const DISCORD_NOTIFICATION_CHANNEL = Symbol('DiscordNotificationChannel');
export const DISCORD_PORT = Symbol('DiscordPort');

const USE_CASES = [
  UseCases.GetDiscordConfigUseCase,
  UseCases.SaveDiscordGuildUseCase,
  UseCases.SetDiscordChannelUseCase,
  UseCases.BotNextMatchUseCase,
  UseCases.BotCheckinUseCase,
  UseCases.BotStandingsUseCase,
  UseCases.BotPlayerUseCase,
  UseCases.BotTeamUseCase,
  UseCases.BotLinkUseCase,
  UseCases.CreateMatchVoiceUseCase,
  UseCases.CloseMatchVoiceUseCase,
  UseCases.ReconcileMatchVoiceUseCase,
  UseCases.AssignVerifiedRoleUseCase,
] as const;

const useCaseProviders: Provider[] = USE_CASES.map((UseCase) => ({
  provide: UseCase,
  inject: [DISCORD_DEPS],
  useFactory: (deps: DiscordDeps) => new UseCase(deps),
}));

@Module({
  imports: [IdentityModule, MatchesModule, PublicSiteModule, TournamentsModule],
  controllers: [AdminDiscordController, BotController],
  providers: [
    {
      provide: DISCORD_PORT,
      inject: [ENV],
      useFactory: (env: Env): DiscordPort =>
        env.DISCORD_PROVIDER === 'bot'
          ? new DiscordRestAdapter({ token: env.DISCORD_BOT_TOKEN ?? '' })
          : new FakeDiscordAdapter(),
    },
    {
      provide: DISCORD_DEPS,
      inject: [
        SUPABASE_ADMIN,
        DISCORD_PORT,
        ENV,
        CURRENT_ORGANIZATION,
        CLOCK,
        ProfileQueries,
        TournamentQueries,
        MATCHES_DEPS,
        GetPublicPlayerUseCase,
        GetPublicTeamUseCase,
      ],
      useFactory: (
        db: AdminClient,
        discord: DiscordPort,
        env: Env,
        organization: CurrentOrganization,
        clock: Clock,
        profiles: ProfileQueries,
        tournaments: TournamentQueries,
        matchesDeps: MatchesDeps,
        player: GetPublicPlayerUseCase,
        team: GetPublicTeamUseCase,
      ): DiscordDeps => {
        const theme: EmbedTheme = { color: DEFAULT_BRAND_COLOR, webOrigin: env.WEB_ORIGIN };
        return {
          directory: new SupabaseDiscordDirectory(db),
          discord,
          botReady: env.DISCORD_PROVIDER === 'bot',
          theme,
          organization,
          clock,
          profiles,
          tournaments,
          queries: {
            myMatches: new ListMyMatchesUseCase(matchesDeps),
            checkIn: new CheckInUseCase(matchesDeps),
            board: new GetPublicBoardUseCase(matchesDeps),
            player,
            team,
          },
        };
      },
    },
    {
      provide: DISCORD_NOTIFICATION_CHANNEL,
      inject: [DISCORD_DEPS, ENV],
      useFactory: (deps: DiscordDeps, env: Env) =>
        new DiscordChannelAdapter({
          directory: deps.directory,
          discord: deps.discord,
          theme: deps.theme,
          organization: deps.organization,
          available: env.DISCORD_PROVIDER === 'bot',
        }),
    },
    ...useCaseProviders,
    DiscordWorker,
  ],
  exports: [DISCORD_NOTIFICATION_CHANNEL],
})
export class DiscordModule {}
