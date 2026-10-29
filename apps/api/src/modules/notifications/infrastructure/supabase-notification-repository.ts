// Postgres adapter of NotificationRepository. The svc_* functions claim work
// with leases (FOR UPDATE SKIP LOCKED), write a whole event atomically and
// audit the admin changes; the unique keys make reprocessing harmless.
import type {
  DeliveryQuery,
  DeliveryStatus,
  NotificationAudience,
  NotificationChannel,
} from '@league/contracts';
import { DELIVERY_STATUSES } from '@league/contracts';
import type { ChannelPreference } from '@league/core';
import type { Json, Tables } from '@league/db';

import { assertNoError } from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
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

const CHUNK = 100;

const chunks = <T>(list: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) =>
    list.slice(i * CHUNK, (i + 1) * CHUNK),
  );

const asRecord = (value: Json): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};

const toEvent = (row: Tables<'outbox_events'>): OutboxEvent => ({
  id: row.id,
  organizationId: row.organization_id,
  aggregateType: row.aggregate_type,
  aggregateId: row.aggregate_id,
  eventType: row.event_type,
  payload: asRecord(row.payload),
  occurredAt: new Date(row.occurred_at),
  attempts: row.attempts,
});

const toTemplate = (row: Tables<'notification_templates'>): TemplateRecord => ({
  organizationId: row.organization_id,
  typeKey: row.type_key,
  channel: row.channel,
  locale: row.locale,
  subject: row.subject,
  body: row.body,
  variables: row.variables,
  version: row.version,
});

const toNotification = (
  row: Pick<
    Tables<'notifications'>,
    'id' | 'user_id' | 'type_key' | 'title' | 'body' | 'link' | 'read_at' | 'created_at'
  >,
): NotificationRecord => ({
  id: row.id,
  userId: row.user_id,
  typeKey: row.type_key,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.read_at ? new Date(row.read_at) : null,
  createdAt: new Date(row.created_at),
});

type DeliveryRow = Tables<'notification_deliveries'>;
type NotificationRef = Pick<Tables<'notifications'>, 'link' | 'organization_id' | 'type_key'>;

const toDelivery = (row: DeliveryRow, notification: NotificationRef | null): DeliveryRecord => ({
  id: row.id,
  notificationId: row.notification_id,
  sourceEventId: row.source_event_id,
  userId: row.user_id,
  channel: row.channel,
  status: row.status,
  subject: row.subject,
  body: row.body,
  attempts: row.attempts,
  lastError: row.last_error,
  sentAt: row.sent_at ? new Date(row.sent_at) : null,
  createdAt: new Date(row.created_at),
  link: notification?.link ?? null,
  organizationId: notification?.organization_id ?? null,
  typeKey: notification?.type_key ?? '',
});

const INBOX_COLUMNS = 'id, user_id, type_key, title, body, link, read_at, created_at';

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly db: AdminClient) {}

  async types(): Promise<NotificationTypeRecord[]> {
    const { data, error } = await this.db.from('notification_types').select('*');
    assertNoError(error);
    return (data ?? []).map((row) => ({
      key: row.key,
      category: row.category,
      critical: row.is_critical,
      defaultChannels: row.default_channels,
      audience: row.audience as NotificationAudience,
      position: row.position,
    }));
  }

  async rules(organizationId: string, tournamentId: string | null): Promise<RuleRecord[]> {
    const { data, error } = await this.db
      .from('notification_rules')
      .select('type_key, tournament_id, enabled, channels')
      .eq('organization_id', organizationId)
      .or(
        tournamentId
          ? `tournament_id.is.null,tournament_id.eq.${tournamentId}`
          : 'tournament_id.is.null',
      );
    assertNoError(error);
    return (data ?? []).map((row) => ({
      typeKey: row.type_key,
      tournamentId: row.tournament_id,
      enabled: row.enabled,
      channels: row.channels,
    }));
  }

  async templates(organizationId: string | null): Promise<TemplateRecord[]> {
    const { data, error } = await this.db
      .from('notification_templates')
      .select('*')
      .or(
        organizationId
          ? `organization_id.is.null,organization_id.eq.${organizationId}`
          : 'organization_id.is.null',
      );
    assertNoError(error);
    return (data ?? []).map(toTemplate);
  }

  async preferencesOf(userIds: readonly string[]): Promise<Map<string, ChannelPreference[]>> {
    const result = new Map<string, ChannelPreference[]>(userIds.map((id) => [id, []]));
    for (const ids of chunks([...new Set(userIds)])) {
      const { data, error } = await this.db
        .from('user_notification_preferences')
        .select('user_id, category, channel, enabled')
        .in('user_id', ids);
      assertNoError(error);
      for (const row of data ?? [])
        result.get(row.user_id)?.push({
          category: row.category,
          channel: row.channel,
          enabled: row.enabled,
        });
    }
    return result;
  }

  async savePreferences(userId: string, items: readonly ChannelPreference[]): Promise<void> {
    const { error } = await this.db.from('user_notification_preferences').upsert(
      items.map((i) => ({
        user_id: userId,
        category: i.category,
        channel: i.channel,
        enabled: i.enabled,
      })),
      { onConflict: 'user_id,category,channel' },
    );
    assertNoError(error);
  }

  async claimEvents(limit: number, leaseSeconds: number): Promise<OutboxEvent[]> {
    const { data, error } = await this.db.rpc('svc_claim_outbox_events', {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    assertNoError(error);
    return (data ?? []).map(toEvent);
  }

  async enqueue(eventId: string, items: readonly NewNotification[]): Promise<number> {
    const { data, error } = await this.db.rpc('svc_enqueue_notifications', {
      p_event_id: eventId,
      p_items: items.map((item) => ({
        user_id: item.userId,
        type_key: item.typeKey,
        title: item.title,
        body: item.body,
        link: item.link,
        data: item.data as Json,
        deliveries: item.deliveries.map((d) => ({
          channel: d.channel,
          subject: d.subject,
          body: d.body,
        })),
      })),
    });
    assertNoError(error);
    return data ?? 0;
  }

  async failEvent(eventId: string, error: string, nextAttemptAt: Date | null): Promise<void> {
    const { error: dbError } = await this.db.rpc('svc_fail_outbox_event', {
      p_event_id: eventId,
      p_error: error,
      // Dead letters keep their last schedule; they are no longer claimed.
      p_next_attempt_at: (nextAttemptAt ?? new Date()).toISOString(),
      p_dead: nextAttemptAt === null,
    });
    assertNoError(dbError);
  }

  async claimDeliveries(limit: number, leaseSeconds: number): Promise<DeliveryRecord[]> {
    const { data, error } = await this.db.rpc('svc_claim_deliveries', {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    assertNoError(error);
    const rows = data ?? [];
    const notifications = await this.notificationRefs(rows.map((r) => r.notification_id));
    return rows.map((row) => toDelivery(row, notifications.get(row.notification_id) ?? null));
  }

  private async notificationRefs(ids: readonly string[]): Promise<Map<string, NotificationRef>> {
    const result = new Map<string, NotificationRef>();
    for (const chunk of chunks([...new Set(ids)])) {
      const { data, error } = await this.db
        .from('notifications')
        .select('id, link, organization_id, type_key')
        .in('id', chunk);
      assertNoError(error);
      for (const row of data ?? []) result.set(row.id, row);
    }
    return result;
  }

  async updateDelivery(deliveryId: string, change: DeliveryChange): Promise<void> {
    const { error } = await this.db
      .from('notification_deliveries')
      .update({
        status: change.status,
        attempts: change.attempts,
        last_error: change.lastError,
        ...(change.nextAttemptAt && { next_attempt_at: change.nextAttemptAt.toISOString() }),
        provider_message_id: change.providerMessageId,
        sent_at: change.sentAt?.toISOString() ?? null,
        locked_until: null,
      })
      .eq('id', deliveryId);
    assertNoError(error);
  }

  async inbox(
    userId: string,
    query: { before?: string | undefined; limit: number; unread: boolean },
  ): Promise<NotificationRecord[]> {
    let request = this.db
      .from('notifications')
      .select(INBOX_COLUMNS)
      .eq('user_id', userId)
      .order('id', { ascending: false })
      .limit(query.limit);
    if (query.before) request = request.lt('id', query.before);
    if (query.unread) request = request.is('read_at', null);
    const { data, error } = await request;
    assertNoError(error);
    return (data ?? []).map(toNotification);
  }

  async unreadCount(userId: string): Promise<number> {
    const { count, error } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    assertNoError(error);
    return count ?? 0;
  }

  async markRead(userId: string, ids: readonly string[] | null, at: Date): Promise<number> {
    let matched = 0;
    if (ids) {
      const { count, error } = await this.db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('id', ids);
      assertNoError(error);
      matched = count ?? 0;
    }
    let update = this.db
      .from('notifications')
      .update({ read_at: at.toISOString() }, { count: 'exact' })
      .eq('user_id', userId)
      .is('read_at', null);
    if (ids) update = update.in('id', ids);
    const { count, error } = await update;
    assertNoError(error);
    return ids ? matched : (count ?? 0);
  }

  async saveRule(
    organizationId: string,
    actorId: string,
    rule: { typeKey: string; enabled: boolean; channels: readonly NotificationChannel[] },
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_save_notification_rule', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_type_key: rule.typeKey,
      p_enabled: rule.enabled,
      p_channels: [...rule.channels],
    });
    assertNoError(error);
  }

  async saveTemplate(
    organizationId: string,
    actorId: string,
    template: Omit<TemplateRecord, 'organizationId' | 'version'>,
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_save_notification_template', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_type_key: template.typeKey,
      p_channel: template.channel,
      p_locale: template.locale,
      // supabase-js drops undefined arguments: always send explicit values.
      p_subject: template.subject ?? '',
      p_body: template.body,
      p_variables: [...template.variables],
    });
    assertNoError(error);
  }

  async resetTemplate(
    organizationId: string,
    actorId: string,
    key: { typeKey: string; channel: NotificationChannel; locale: string },
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_reset_notification_template', {
      p_organization_id: organizationId,
      p_actor: actorId,
      p_type_key: key.typeKey,
      p_channel: key.channel,
      p_locale: key.locale,
    });
    assertNoError(error);
  }

  async deliveries(query: DeliveryQuery, limit: number): Promise<DeliveryRecord[]> {
    let request = this.db
      .from('notification_deliveries')
      .select('*, notifications ( link, organization_id, type_key )')
      .order('id', { ascending: false })
      .limit(limit);
    if (query.status) request = request.eq('status', query.status);
    if (query.channel) request = request.eq('channel', query.channel);
    if (query.before) request = request.lt('id', query.before);
    const { data, error } = await request;
    assertNoError(error);
    return (data ?? []).map((row) => toDelivery(row, row.notifications));
  }

  async deliveryCounts(since: Date): Promise<Record<DeliveryStatus, number>> {
    const entries = await Promise.all(
      DELIVERY_STATUSES.map(async (status) => {
        const { count, error } = await this.db
          .from('notification_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('status', status)
          .gte('created_at', since.toISOString());
        assertNoError(error);
        return [status, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<DeliveryStatus, number>;
  }

  async outboxCounts(): Promise<{ pending: number; dead: number }> {
    const [pending, dead] = await Promise.all([
      this.db
        .from('outbox_events')
        .select('id', { count: 'exact', head: true })
        .is('published_at', null)
        .is('dead_at', null),
      this.db
        .from('outbox_events')
        .select('id', { count: 'exact', head: true })
        .not('dead_at', 'is', null),
    ]);
    assertNoError(pending.error);
    assertNoError(dead.error);
    return { pending: pending.count ?? 0, dead: dead.count ?? 0 };
  }
}
