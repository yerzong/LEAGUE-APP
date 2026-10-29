import { randomUUID } from 'node:crypto';

import type { DeliveryQuery, DeliveryStatus, NotificationChannel } from '@league/contracts';
import type { ChannelPreference } from '@league/core';

import type { Clock } from '../../../shared/clock.js';
import type { DeliveryChange, NotificationRepository } from '../application/ports.js';
import type {
  DeliveryRecord,
  NewNotification,
  NotificationRecord,
  NotificationTypeRecord,
  OutboxEvent,
  RuleRecord,
  TemplateRecord,
} from '../domain/notification.js';

interface StoredEvent extends OutboxEvent {
  publishedAt: Date | null;
  nextAttemptAt: Date | null;
  lockedUntil: Date | null;
  lastError: string | null;
  dead: boolean;
}

interface StoredNotification extends NotificationRecord {
  organizationId: string | null;
  sourceEventId: string;
  data: Readonly<Record<string, unknown>>;
}

interface StoredDelivery extends Omit<DeliveryRecord, 'link' | 'organizationId' | 'typeKey'> {
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  providerMessageId: string | null;
}

/** Ids that sort by creation time, like uuid v7. */
let sequence = 0;
const orderedId = () => `${(sequence++).toString(16).padStart(8, '0')}-${randomUUID().slice(9)}`;

/** NotificationRepository in memory, with the database's unique keys and leases. */
export class InMemoryNotificationRepository implements NotificationRepository {
  readonly events: StoredEvent[] = [];
  readonly notifications: StoredNotification[] = [];
  readonly deliveriesTable: StoredDelivery[] = [];
  readonly rulesTable: (RuleRecord & { organizationId: string })[] = [];
  readonly templatesTable: TemplateRecord[] = [];
  readonly preferences = new Map<string, ChannelPreference[]>();
  readonly audit: { action: string; actorId: string; entity: string }[] = [];

  constructor(
    private readonly clock: Clock,
    readonly typesTable: NotificationTypeRecord[],
    templates: readonly TemplateRecord[] = [],
  ) {
    this.templatesTable.push(...templates);
  }

  /** A module emits an event (what svc_* functions do in the database). */
  emit(event: Omit<OutboxEvent, 'id' | 'attempts' | 'occurredAt'> & { occurredAt?: Date }): string {
    const id = orderedId();
    this.events.push({
      ...event,
      id,
      attempts: 0,
      occurredAt: event.occurredAt ?? this.clock.now(),
      publishedAt: null,
      nextAttemptAt: null,
      lockedUntil: null,
      lastError: null,
      dead: false,
    });
    return id;
  }

  types(): Promise<NotificationTypeRecord[]> {
    return Promise.resolve([...this.typesTable]);
  }

  rules(organizationId: string, tournamentId: string | null): Promise<RuleRecord[]> {
    return Promise.resolve(
      this.rulesTable.filter(
        (r) =>
          r.organizationId === organizationId &&
          (r.tournamentId === null || r.tournamentId === tournamentId),
      ),
    );
  }

  templates(organizationId: string | null): Promise<TemplateRecord[]> {
    return Promise.resolve(
      this.templatesTable.filter(
        (t) => t.organizationId === null || t.organizationId === organizationId,
      ),
    );
  }

  preferencesOf(userIds: readonly string[]): Promise<Map<string, ChannelPreference[]>> {
    return Promise.resolve(
      new Map(userIds.map((id) => [id, [...(this.preferences.get(id) ?? [])]])),
    );
  }

  savePreferences(userId: string, items: readonly ChannelPreference[]): Promise<void> {
    const current = (this.preferences.get(userId) ?? []).filter(
      (p) => !items.some((i) => i.category === p.category && i.channel === p.channel),
    );
    this.preferences.set(userId, [...current, ...items]);
    return Promise.resolve();
  }

  claimEvents(limit: number, leaseSeconds: number): Promise<OutboxEvent[]> {
    const now = this.clock.now();
    const due = this.events
      .filter(
        (e) =>
          !e.publishedAt &&
          !e.dead &&
          (!e.nextAttemptAt || e.nextAttemptAt <= now) &&
          (!e.lockedUntil || e.lockedUntil < now),
      )
      .slice(0, limit);
    for (const e of due) e.lockedUntil = new Date(now.getTime() + leaseSeconds * 1000);
    return Promise.resolve(due.map((e) => ({ ...e })));
  }

  enqueue(eventId: string, items: readonly NewNotification[]): Promise<number> {
    const event = this.events.find((e) => e.id === eventId);
    if (!event) return Promise.reject(new Error('event_not_found'));
    if (event.publishedAt) return Promise.resolve(0);
    let created = 0;
    const now = this.clock.now();
    for (const item of items) {
      if (this.notifications.some((n) => n.sourceEventId === eventId && n.userId === item.userId))
        continue;
      const notification: StoredNotification = {
        id: orderedId(),
        organizationId: event.organizationId,
        userId: item.userId,
        typeKey: item.typeKey,
        title: item.title,
        body: item.body,
        link: item.link,
        data: item.data,
        readAt: null,
        createdAt: now,
        sourceEventId: eventId,
      };
      this.notifications.push(notification);
      created += 1;
      for (const d of item.deliveries) {
        if (
          this.deliveriesTable.some(
            (x) =>
              x.sourceEventId === eventId && x.userId === item.userId && x.channel === d.channel,
          )
        )
          continue;
        const inApp = d.channel === 'in_app';
        this.deliveriesTable.push({
          id: orderedId(),
          notificationId: notification.id,
          sourceEventId: eventId,
          userId: item.userId,
          channel: d.channel,
          status: inApp ? 'delivered' : 'queued',
          subject: d.subject,
          body: d.body,
          attempts: 0,
          lastError: null,
          sentAt: inApp ? now : null,
          createdAt: now,
          nextAttemptAt: now,
          lockedUntil: null,
          providerMessageId: null,
        });
      }
    }
    event.publishedAt = now;
    event.lockedUntil = null;
    return Promise.resolve(created);
  }

  failEvent(eventId: string, error: string, nextAttemptAt: Date | null): Promise<void> {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      Object.assign(event, {
        attempts: event.attempts + 1,
        lastError: error,
        nextAttemptAt,
        lockedUntil: null,
        dead: nextAttemptAt === null,
      });
    }
    return Promise.resolve();
  }

  private withNotification(d: StoredDelivery): DeliveryRecord {
    const n = this.notifications.find((x) => x.id === d.notificationId);
    return {
      ...d,
      link: n?.link ?? null,
      organizationId: n?.organizationId ?? null,
      typeKey: n?.typeKey ?? '',
    };
  }

  claimDeliveries(limit: number, leaseSeconds: number): Promise<DeliveryRecord[]> {
    const now = this.clock.now();
    const due = this.deliveriesTable
      .filter(
        (d) =>
          d.status === 'queued' &&
          d.nextAttemptAt <= now &&
          (!d.lockedUntil || d.lockedUntil < now),
      )
      .slice(0, limit);
    for (const d of due) d.lockedUntil = new Date(now.getTime() + leaseSeconds * 1000);
    return Promise.resolve(due.map((d) => this.withNotification(d)));
  }

  updateDelivery(deliveryId: string, change: DeliveryChange): Promise<void> {
    const d = this.deliveriesTable.find((x) => x.id === deliveryId);
    if (d) {
      Object.assign(d, {
        status: change.status,
        attempts: change.attempts,
        lastError: change.lastError,
        nextAttemptAt: change.nextAttemptAt ?? d.nextAttemptAt,
        providerMessageId: change.providerMessageId,
        sentAt: change.sentAt,
        lockedUntil: null,
      });
    }
    return Promise.resolve();
  }

  inbox(
    userId: string,
    query: { before?: string | undefined; limit: number; unread: boolean },
  ): Promise<NotificationRecord[]> {
    return Promise.resolve(
      this.notifications
        .filter(
          (n) =>
            n.userId === userId &&
            (!query.unread || !n.readAt) &&
            (!query.before || n.id < query.before),
        )
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, query.limit),
    );
  }

  unreadCount(userId: string): Promise<number> {
    return Promise.resolve(
      this.notifications.filter((n) => n.userId === userId && !n.readAt).length,
    );
  }

  markRead(userId: string, ids: readonly string[] | null, at: Date): Promise<number> {
    const matched = this.notifications.filter(
      (n) => n.userId === userId && (ids === null ? !n.readAt : ids.includes(n.id)),
    );
    for (const n of matched) Object.assign(n, { readAt: n.readAt ?? at });
    return Promise.resolve(matched.length);
  }

  saveRule(
    organizationId: string,
    actorId: string,
    rule: { typeKey: string; enabled: boolean; channels: readonly NotificationChannel[] },
  ): Promise<void> {
    const existing = this.rulesTable.findIndex(
      (r) =>
        r.organizationId === organizationId &&
        r.tournamentId === null &&
        r.typeKey === rule.typeKey,
    );
    const row = { ...rule, organizationId, tournamentId: null };
    if (existing >= 0) this.rulesTable[existing] = row;
    else this.rulesTable.push(row);
    this.audit.push({ action: 'notification_rule.updated', actorId, entity: rule.typeKey });
    return Promise.resolve();
  }

  saveTemplate(
    organizationId: string,
    actorId: string,
    template: Omit<TemplateRecord, 'organizationId' | 'version'>,
  ): Promise<void> {
    const index = this.templatesTable.findIndex(
      (t) =>
        t.organizationId === organizationId &&
        t.typeKey === template.typeKey &&
        t.channel === template.channel &&
        t.locale === template.locale,
    );
    const version = index >= 0 ? (this.templatesTable[index]?.version ?? 0) + 1 : 1;
    const row = { ...template, organizationId, version };
    if (index >= 0) this.templatesTable[index] = row;
    else this.templatesTable.push(row);
    this.audit.push({ action: 'notification_template.updated', actorId, entity: template.typeKey });
    return Promise.resolve();
  }

  resetTemplate(
    organizationId: string,
    actorId: string,
    key: { typeKey: string; channel: NotificationChannel; locale: string },
  ): Promise<void> {
    const index = this.templatesTable.findIndex(
      (t) =>
        t.organizationId === organizationId &&
        t.typeKey === key.typeKey &&
        t.channel === key.channel &&
        t.locale === key.locale,
    );
    if (index >= 0) {
      this.templatesTable.splice(index, 1);
      this.audit.push({ action: 'notification_template.reset', actorId, entity: key.typeKey });
    }
    return Promise.resolve();
  }

  deliveries(query: DeliveryQuery, limit: number): Promise<DeliveryRecord[]> {
    return Promise.resolve(
      this.deliveriesTable
        .filter(
          (d) =>
            (!query.status || d.status === query.status) &&
            (!query.channel || d.channel === query.channel) &&
            (!query.before || d.id < query.before),
        )
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, limit)
        .map((d) => this.withNotification(d)),
    );
  }

  deliveryCounts(since: Date): Promise<Record<DeliveryStatus, number>> {
    const counts: Record<DeliveryStatus, number> = { queued: 0, sent: 0, delivered: 0, failed: 0 };
    for (const d of this.deliveriesTable) if (d.createdAt >= since) counts[d.status] += 1;
    return Promise.resolve(counts);
  }

  outboxCounts(): Promise<{ pending: number; dead: number }> {
    return Promise.resolve({
      pending: this.events.filter((e) => !e.publishedAt && !e.dead).length,
      dead: this.events.filter((e) => e.dead).length,
    });
  }
}
