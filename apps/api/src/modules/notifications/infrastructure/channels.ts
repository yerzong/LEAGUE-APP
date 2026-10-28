// Channel adapters of NotificationChannelPort (docs/15 §1). In-app and email
// work in this module; Discord and push are registered but not available
// until their modules arrive, so the engine never queues them.

import { format, DEFAULT_LOCALE, getMessages } from '@league/i18n';
import { EmailError, emailHtml, type EmailPort } from '@league/integrations';

import {
  ChannelSendError,
  type NotificationChannelPort,
  type RecipientDirectory,
} from '../application/ports.js';
import type { DeliveryRecord } from '../domain/notification.js';

const server = getMessages(DEFAULT_LOCALE).notifications.server;

/** The inbox row is the delivery: written as `delivered` with the notification. */
export class InAppChannelAdapter implements NotificationChannelPort {
  readonly channel = 'in_app' as const;
  readonly available = true;

  send(): Promise<{ providerMessageId: string | null }> {
    return Promise.resolve({ providerMessageId: null });
  }
}

export interface EmailChannelOptions {
  readonly email: EmailPort;
  readonly directory: Pick<RecipientDirectory, 'emailOf'>;
  /** Signs the footer ("your account at …"). */
  readonly organizationName: (organizationId: string | null) => Promise<string>;
  /** Absolute links in the email (WEB_ORIGIN). */
  readonly webOrigin: string;
}

export class EmailChannelAdapter implements NotificationChannelPort {
  readonly channel = 'email' as const;
  readonly available = true;

  constructor(private readonly options: EmailChannelOptions) {}

  async send(delivery: DeliveryRecord): Promise<{ providerMessageId: string | null }> {
    const to = await this.options.directory.emailOf(delivery.userId);
    if (!to) throw new ChannelSendError('no_email_address', false);
    const origin = this.options.webOrigin.replace(/\/$/, '');
    const footer = format(server.emailFooter, {
      organization: await this.options.organizationName(delivery.organizationId),
      url: `${origin}/app/ajustes/notificaciones`,
    });
    const subject = delivery.subject ?? '';
    const action = delivery.link
      ? { label: server.emailAction, url: `${origin}${delivery.link}` }
      : null;
    try {
      return await this.options.email.send({
        to,
        subject,
        text: [delivery.body, action ? `${action.label}: ${action.url}` : '', footer]
          .filter(Boolean)
          .join('\n\n'),
        html: emailHtml({ title: subject, body: delivery.body, action, footer }),
        idempotencyKey: delivery.id,
      });
    } catch (error) {
      if (error instanceof EmailError)
        throw new ChannelSendError(`email_${error.kind}`, error.retryable);
      throw error;
    }
  }
}

/** Registered for the Discord module (DM and channels); not available yet. */
export class DiscordChannelAdapter implements NotificationChannelPort {
  readonly channel = 'discord' as const;
  readonly available = false;

  send(): Promise<{ providerMessageId: string | null }> {
    return Promise.reject(new ChannelSendError('channel_not_implemented', false));
  }
}

/** Registered for web push / native push (push_subscriptions); not available yet. */
export class PushChannelAdapter implements NotificationChannelPort {
  readonly channel = 'push' as const;
  readonly available = false;

  send(): Promise<{ providerMessageId: string | null }> {
    return Promise.reject(new ChannelSendError('channel_not_implemented', false));
  }
}
