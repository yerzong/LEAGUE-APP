// The DiscordChannelPort the m06 engine queues (replaces the registered stub).
// A staff notification goes to the configured staff channel; everything else is
// a DM to the recipient's linked Discord account. Unavailable until a bot token
// is configured, so without it the engine never queues Discord (stack still runs).

import {
  DiscordError,
  notificationMessage,
  type DiscordPort,
  type EmbedTheme,
} from '@league/integrations';

import {
  ChannelSendError,
  type NotificationChannelPort,
} from '../../notifications/application/ports.js';
import type { DeliveryRecord } from '../../notifications/domain/notification.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type { DiscordDirectory } from '../application/ports.js';

export interface DiscordChannelOptions {
  readonly directory: DiscordDirectory;
  readonly discord: DiscordPort;
  readonly theme: EmbedTheme;
  readonly organization: CurrentOrganization;
  /** False when no bot token is configured: the engine skips Discord entirely. */
  readonly available: boolean;
}

/** Staff-scoped notification types post to the staff channel instead of a DM. */
const isStaffType = (typeKey: string) => typeKey.startsWith('staff.');

export class DiscordChannelAdapter implements NotificationChannelPort {
  readonly channel = 'discord' as const;
  readonly available: boolean;

  constructor(private readonly options: DiscordChannelOptions) {
    this.available = options.available;
  }

  async send(delivery: DeliveryRecord): Promise<{ providerMessageId: string | null }> {
    const organizationId = delivery.organizationId ?? (await this.options.organization.id());
    const message = notificationMessage(this.options.theme, {
      subject: delivery.subject ?? '',
      body: delivery.body,
      path: delivery.link,
    });
    try {
      if (isStaffType(delivery.typeKey)) {
        const channelId = await this.options.directory.channelIdFor(organizationId, 'staff', null);
        if (!channelId) throw new ChannelSendError('discord_no_staff_channel', false);
        const { messageId } = await this.options.discord.sendChannelMessage(channelId, message);
        return { providerMessageId: messageId };
      }
      const discordId = await this.options.directory.discordIdOf(delivery.userId);
      if (!discordId) throw new ChannelSendError('discord_not_linked', false);
      const { messageId } = await this.options.discord.sendDirectMessage(discordId, message);
      return { providerMessageId: messageId };
    } catch (error) {
      if (error instanceof ChannelSendError) throw error;
      if (error instanceof DiscordError)
        throw new ChannelSendError(`discord_${error.kind}`, error.retryable);
      throw error;
    }
  }
}
