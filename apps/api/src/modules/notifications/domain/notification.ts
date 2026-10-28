import type {
  DeliveryStatus,
  NotificationAudience,
  NotificationCategory,
  NotificationChannel,
} from '@league/contracts';
import type { NotificationTypeDef } from '@league/core';

/** A row of outbox_events (written by every module with its change). */
export interface OutboxEvent {
  readonly id: string;
  readonly organizationId: string | null;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
  readonly attempts: number;
}

export interface NotificationTypeRecord extends NotificationTypeDef {
  readonly audience: NotificationAudience;
  readonly position: number;
}

export interface TemplateRecord {
  /** null: the platform's base template. */
  readonly organizationId: string | null;
  readonly typeKey: string;
  readonly channel: NotificationChannel;
  readonly locale: string;
  readonly subject: string | null;
  readonly body: string;
  readonly variables: readonly string[];
  readonly version: number;
}

export interface RuleRecord {
  readonly typeKey: string;
  /** null: the organization-wide rule. */
  readonly tournamentId: string | null;
  readonly enabled: boolean;
  readonly channels: readonly NotificationChannel[] | null;
}

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly typeKey: string;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface DeliveryRecord {
  readonly id: string;
  readonly notificationId: string;
  readonly sourceEventId: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly status: DeliveryStatus;
  readonly subject: string | null;
  readonly body: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
  /** From the notification: where the email's button points and whose name signs it. */
  readonly link: string | null;
  readonly organizationId: string | null;
  readonly typeKey: string;
}

/** One recipient's notification and its deliveries, rendered for each channel. */
export interface NewNotification {
  readonly userId: string;
  readonly typeKey: string;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly data: Readonly<Record<string, unknown>>;
  readonly deliveries: readonly {
    readonly channel: NotificationChannel;
    readonly subject: string | null;
    readonly body: string;
  }[];
}

export type { NotificationCategory, NotificationChannel };
