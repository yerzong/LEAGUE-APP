import type {
  DeliveryQuery,
  DeliveryStatus,
  NotificationCategory,
  NotificationChannel,
} from '@league/contracts';
import type { ChannelPreference } from '@league/core';

import type {
  DeliveryRecord,
  NewNotification,
  NotificationRecord,
  NotificationTypeRecord,
  OutboxEvent,
  RuleRecord,
  TemplateRecord,
} from '../domain/notification.js';

export interface DeliveryChange {
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly nextAttemptAt: Date | null;
  readonly providerMessageId: string | null;
  readonly sentAt: Date | null;
}

export interface NotificationRepository {
  types(): Promise<NotificationTypeRecord[]>;
  /** Organization-wide rules plus the tournament's own ones (when given). */
  rules(organizationId: string, tournamentId: string | null): Promise<RuleRecord[]>;
  /** The base templates and the organization's overrides. */
  templates(organizationId: string | null): Promise<TemplateRecord[]>;
  preferencesOf(userIds: readonly string[]): Promise<Map<string, ChannelPreference[]>>;
  savePreferences(userId: string, items: readonly ChannelPreference[]): Promise<void>;

  /** Due, unpublished events, leased to this worker. */
  claimEvents(limit: number, leaseSeconds: number): Promise<OutboxEvent[]>;
  /** Writes the notifications and marks the event published (idempotent). */
  enqueue(eventId: string, items: readonly NewNotification[]): Promise<number>;
  /** `nextAttemptAt` null: dead letter. */
  failEvent(eventId: string, error: string, nextAttemptAt: Date | null): Promise<void>;

  claimDeliveries(limit: number, leaseSeconds: number): Promise<DeliveryRecord[]>;
  updateDelivery(deliveryId: string, change: DeliveryChange): Promise<void>;

  inbox(
    userId: string,
    query: { before?: string | undefined; limit: number; unread: boolean },
  ): Promise<NotificationRecord[]>;
  unreadCount(userId: string): Promise<number>;
  /**
   * Marks the user's notifications read (all of them when `ids` is null);
   * returns how many of the user's notifications matched, read or not.
   */
  markRead(userId: string, ids: readonly string[] | null, at: Date): Promise<number>;

  saveRule(
    organizationId: string,
    actorId: string,
    rule: { typeKey: string; enabled: boolean; channels: readonly NotificationChannel[] },
  ): Promise<void>;
  saveTemplate(
    organizationId: string,
    actorId: string,
    template: Omit<TemplateRecord, 'organizationId' | 'version'>,
  ): Promise<void>;
  resetTemplate(
    organizationId: string,
    actorId: string,
    key: { typeKey: string; channel: NotificationChannel; locale: string },
  ): Promise<void>;
  deliveries(query: DeliveryQuery, limit: number): Promise<DeliveryRecord[]>;
  deliveryCounts(since: Date): Promise<Record<DeliveryStatus, number>>;
  outboxCounts(): Promise<{ pending: number; dead: number }>;
}

/** What an event is about, loaded once to render its notifications. */
export interface EventContext {
  readonly organization: { readonly id: string; readonly name: string };
  readonly tournament: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly timezone: string;
  };
  /** The registration of an entrant event. */
  readonly entrant: {
    readonly id: string;
    readonly name: string;
    readonly reason: string | null;
  } | null;
  readonly match: {
    readonly id: string;
    readonly scheduledAt: Date | null;
    readonly entrantA: { readonly id: string; readonly name: string } | null;
    readonly entrantB: { readonly id: string; readonly name: string } | null;
    readonly winnerId: string | null;
  } | null;
}

export interface RecipientProfile {
  readonly username: string | null;
  readonly displayName: string | null;
  readonly locale: string;
}

/** Recipients and context of events (registrations, matches, staff, profiles). */
export interface RecipientDirectory {
  /** `null` when the subject of the event no longer exists. */
  contextOf(event: OutboxEvent): Promise<EventContext | null>;
  /** Roster, captains and submitter of each registration (active users only). */
  membersOf(entrantIds: readonly string[]): Promise<Map<string, string[]>>;
  approvedEntrants(tournamentId: string): Promise<{ id: string; name: string }[]>;
  /** Super admins and the tournament's staff. */
  staffOf(tournamentId: string): Promise<string[]>;
  /** Users who turned on some channel of an opt-in category. */
  optedIn(category: NotificationCategory): Promise<string[]>;
  profiles(userIds: readonly string[]): Promise<Map<string, RecipientProfile>>;
  /** Where an email goes. Never logged. */
  emailOf(userId: string): Promise<string | null>;
}

/** A send that failed; `retryable` decides between a retry and `failed`. */
export class ChannelSendError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'ChannelSendError';
  }
}

/** One delivery channel (docs/15 §1): adding one is adding an adapter. */
export interface NotificationChannelPort {
  readonly channel: NotificationChannel;
  /** False for the channels registered for later modules (Discord, push). */
  readonly available: boolean;
  send(delivery: DeliveryRecord): Promise<{ providerMessageId: string | null }>;
}

export interface StaffCheck {
  isStaff(userId: string): Promise<boolean>;
}
