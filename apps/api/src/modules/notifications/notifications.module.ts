import { FakeEmailAdapter, ResendEmailAdapter, type EmailPort } from '@league/integrations';
import { Module, type Provider } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { CURRENT_ORGANIZATION, type CurrentOrganization } from '../../shared/organization.js';
import { ProfileQueries } from '../identity/application/profile.use-cases.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NOTIFICATIONS_DEPS, type NotificationsDeps } from './application/deps.js';
import * as UseCases from './application/notifications.use-cases.js';
import {
  EmailChannelAdapter,
  InAppChannelAdapter,
  PushChannelAdapter,
} from './infrastructure/channels.js';
import { DiscordModule, DISCORD_NOTIFICATION_CHANNEL } from '../discord/discord.module.js';
import type { NotificationChannelPort } from './application/ports.js';
import { NotificationWorker } from './infrastructure/notification-worker.js';
import { SupabaseNotificationRepository } from './infrastructure/supabase-notification-repository.js';
import { SupabaseRecipientDirectory } from './infrastructure/supabase-recipient-directory.js';
import {
  AdminNotificationsController,
  NotificationsController,
} from './presentation/notifications.controller.js';

/** Resend in production; the fake keeps messages in memory (tests, CI, local). */
export const EMAIL_PORT = Symbol('EmailPort');

/** Every use case takes the same dependency bundle. */
const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [NOTIFICATIONS_DEPS],
  useFactory: (deps: NotificationsDeps) => new UseCase(deps),
}));

@Module({
  imports: [IdentityModule, DiscordModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    {
      provide: EMAIL_PORT,
      inject: [ENV],
      useFactory: (env: Env): EmailPort =>
        env.EMAIL_PROVIDER === 'resend'
          ? new ResendEmailAdapter({ apiKey: env.RESEND_API_KEY ?? '', from: env.EMAIL_FROM ?? '' })
          : new FakeEmailAdapter(),
    },
    {
      provide: NOTIFICATIONS_DEPS,
      inject: [
        SUPABASE_ADMIN,
        EMAIL_PORT,
        DISCORD_NOTIFICATION_CHANNEL,
        ProfileQueries,
        CURRENT_ORGANIZATION,
        CLOCK,
        ENV,
      ],
      useFactory: (
        db: AdminClient,
        email: EmailPort,
        discordChannel: NotificationChannelPort,
        profiles: ProfileQueries,
        organization: CurrentOrganization,
        clock: Clock,
        env: Env,
      ): NotificationsDeps => {
        const directory = new SupabaseRecipientDirectory(db);
        return {
          notifications: new SupabaseNotificationRepository(db),
          directory,
          channels: [
            new InAppChannelAdapter(),
            new EmailChannelAdapter({
              email,
              directory,
              organizationName: (id) => directory.organizationName(id),
              webOrigin: env.WEB_ORIGIN,
            }),
            discordChannel,
            new PushChannelAdapter(),
          ],
          staff: profiles,
          organization,
          clock,
          settings: { maxEventAgeHours: env.NOTIFICATIONS_MAX_EVENT_AGE_HOURS, batchSize: 25 },
        };
      },
    },
    ...useCaseProviders,
    NotificationWorker,
  ],
})
export class NotificationsModule {}
