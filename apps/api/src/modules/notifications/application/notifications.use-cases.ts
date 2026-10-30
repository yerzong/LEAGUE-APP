// Notification use cases. The engine turns outbox events into one in-app
// notification per recipient plus a delivery per channel (packages/core
// decides the channels and renders the templates); the dispatcher sends the
// queued deliveries through the channel adapters with retries; the rest is
// the inbox, the preferences and the admin console.

import {
  type AdminNotificationType,
  type AdminNotificationTypeDetail,
  type DeliveryHistory,
  type DeliveryQuery,
  type Inbox,
  type InboxQuery,
  type NotificationChannel,
  type NotificationPreferences,
  type NotificationTemplate,
  type PreviewTemplateRequest,
  type SaveTemplateRequest,
  type TemplatePreview,
  type UnreadCount,
  type UpdatePreferencesRequest,
  type UpdateRuleRequest,
} from '@league/contracts';
import {
  decideChannels,
  isOptInCategory,
  nextAttemptAt,
  preferenceMatrix,
  renderTemplate,
  templateVariables,
} from '@league/core';
import { DEFAULT_LOCALE, getMessages } from '@league/i18n';

import {
  ApplicationError,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/application-error.js';
import type {
  NewNotification,
  NotificationTypeRecord,
  OutboxEvent,
  RuleRecord,
  TemplateRecord,
} from '../domain/notification.js';
import { EVENT_NOTIFICATIONS, linkOf, variablesOf } from './catalog.js';
import type { NotificationsDeps } from './deps.js';
import { ChannelSendError, type EventContext } from './ports.js';

const server = getMessages(DEFAULT_LOCALE).notifications.server;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requireStaff(deps: NotificationsDeps, userId: string) {
  if (!(await deps.staff.isStaff(userId))) throw forbidden('staff_only');
}

const availableChannels = (deps: NotificationsDeps): NotificationChannel[] =>
  deps.channels.filter((c) => c.available).map((c) => c.channel);

/** Most specific rule wins: the tournament's, then the organization's. */
const ruleFor = (rules: readonly RuleRecord[], typeKey: string, tournamentId: string | null) =>
  rules.find(
    (r) => r.typeKey === typeKey && r.tournamentId !== null && r.tournamentId === tournamentId,
  ) ??
  rules.find((r) => r.typeKey === typeKey && r.tournamentId === null) ??
  null;

/** The organization's text, then the base one; the user's locale, then the default; in-app text last. */
function pickTemplate(
  templates: readonly TemplateRecord[],
  organizationId: string | null,
  typeKey: string,
  channel: NotificationChannel,
  locale: string,
): TemplateRecord | null {
  const find = (org: string | null, ch: NotificationChannel, loc: string) =>
    templates.find(
      (t) =>
        t.organizationId === org && t.typeKey === typeKey && t.channel === ch && t.locale === loc,
    );
  for (const ch of channel === 'in_app' ? [channel] : [channel, 'in_app' as const])
    for (const loc of [locale, DEFAULT_LOCALE]) {
      const found =
        (organizationId ? find(organizationId, ch, loc) : undefined) ?? find(null, ch, loc);
      if (found) return found;
    }
  return null;
}

/** `{ 'a.b': 'x' }` → `{ a: { b: 'x' } }`, the shape templates read. */
function nest(flat: Readonly<Record<string, string>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) {
      node[part] ??= {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1] as string] = value;
  }
  return out;
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function formatWhen(at: Date | null, locale: string, timeZone: string): string {
  if (!at) return '';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(at);
}

const errorText = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error').slice(0, 500);

// ---------------------------------------------------------------------------
// Engine: outbox event → notifications and deliveries
// ---------------------------------------------------------------------------

interface Recipient {
  readonly userId: string;
  readonly entrant: { readonly name: string } | null;
  readonly opponent: { readonly name: string } | null;
}

async function recipientsOf(
  deps: NotificationsDeps,
  type: NotificationTypeRecord,
  ctx: EventContext,
): Promise<Recipient[]> {
  const { directory } = deps;
  switch (type.audience) {
    case 'entrant': {
      if (!ctx.entrant) return [];
      const members = await directory.membersOf([ctx.entrant.id]);
      return (members.get(ctx.entrant.id) ?? []).map((userId) => ({
        userId,
        entrant: ctx.entrant,
        opponent: null,
      }));
    }
    case 'match_parties': {
      const sides = [ctx.match?.entrantA ?? null, ctx.match?.entrantB ?? null];
      const ids = sides.flatMap((s) => (s ? [s.id] : []));
      const members = await directory.membersOf(ids);
      return sides.flatMap((side, i) =>
        side
          ? (members.get(side.id) ?? []).map((userId) => ({
              userId,
              entrant: side,
              opponent: sides[1 - i] ?? null,
            }))
          : [],
      );
    }
    case 'tournament_entrants': {
      const entrants = await directory.approvedEntrants(ctx.tournament.id);
      const members = await directory.membersOf(entrants.map((e) => e.id));
      return entrants.flatMap((entrant) =>
        (members.get(entrant.id) ?? []).map((userId) => ({ userId, entrant, opponent: null })),
      );
    }
    case 'tournament_staff': {
      const entrant = ctx.entrant ?? ctx.match?.entrantA ?? null;
      return (await directory.staffOf(ctx.tournament.id)).map((userId) => ({
        userId,
        entrant,
        opponent: ctx.match?.entrantB ?? null,
      }));
    }
    case 'opted_in':
      return (await directory.optedIn(type.category)).map((userId) => ({
        userId,
        entrant: null,
        opponent: null,
      }));
    case 'followers': {
      const a = ctx.match?.entrantA ?? null;
      const b = ctx.match?.entrantB ?? null;
      const sides = [a, b].flatMap((s) => (s ? [s] : []));
      const followers = await directory.followersOf(
        sides.map((s) => s.id),
        ctx.tournament.id,
      );
      const seen = new Set<string>();
      return followers.flatMap(({ userId, entrantId }) => {
        if (seen.has(userId)) return [];
        seen.add(userId);
        // A tournament follower hears about side A against side B.
        const entrant = sides.find((s) => s.id === entrantId) ?? a;
        const opponent = entrant === a ? b : a;
        return [{ userId, entrant, opponent }];
      });
    }
  }
}

/** Catalog, templates and rules read once per worker pass (they rarely change). */
class CatalogCache {
  private readonly memo = new Map<string, Promise<unknown>>();

  constructor(private readonly deps: NotificationsDeps) {}

  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    let value = this.memo.get(key) as Promise<T> | undefined;
    if (!value) {
      value = load();
      this.memo.set(key, value);
    }
    return value;
  }

  types() {
    return this.once('types', () => this.deps.notifications.types());
  }

  templates(organizationId: string) {
    return this.once(`templates:${organizationId}`, () =>
      this.deps.notifications.templates(organizationId),
    );
  }

  rules(organizationId: string, tournamentId: string) {
    return this.once(`rules:${organizationId}:${tournamentId}`, () =>
      this.deps.notifications.rules(organizationId, tournamentId),
    );
  }
}

/** Notifications of one event, idempotent: the repository ignores what already exists. */
export class ProcessEventUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(event: OutboxEvent, catalog = new CatalogCache(this.deps)): Promise<number> {
    const { deps } = this;
    const mappings = (EVENT_NOTIFICATIONS[event.eventType] ?? []).filter(
      (m) => !m.when || m.when(event.payload),
    );
    const age = deps.clock.now().getTime() - event.occurredAt.getTime();
    if (mappings.length === 0 || age > deps.settings.maxEventAgeHours * 3600_000)
      return deps.notifications.enqueue(event.id, []);
    const ctx = await deps.directory.contextOf(event);
    if (!ctx) return deps.notifications.enqueue(event.id, []);

    const [types, rules, templates] = await Promise.all([
      catalog.types(),
      catalog.rules(ctx.organization.id, ctx.tournament.id),
      catalog.templates(ctx.organization.id),
    ]);
    const planned: { type: NotificationTypeRecord; recipient: Recipient }[] = [];
    const seen = new Set<string>();
    for (const mapping of mappings) {
      const type = types.find((t) => t.key === mapping.type);
      if (!type) continue;
      for (const recipient of await recipientsOf(deps, type, ctx)) {
        if (seen.has(recipient.userId)) continue;
        seen.add(recipient.userId);
        planned.push({ type, recipient });
      }
    }

    const userIds = planned.map((p) => p.recipient.userId);
    const [preferences, profiles] = await Promise.all([
      deps.notifications.preferencesOf(userIds),
      deps.directory.profiles(userIds),
    ]);
    const available = availableChannels(deps);
    const items: NewNotification[] = [];
    for (const { type, recipient } of planned) {
      const channels = decideChannels({
        type,
        rule: ruleFor(rules, type.key, ctx.tournament.id),
        preferences: preferences.get(recipient.userId) ?? [],
        available,
      });
      if (channels.length === 0) continue;
      const profile = profiles.get(recipient.userId);
      const locale = profile?.locale ?? DEFAULT_LOCALE;
      const winner = [ctx.match?.entrantA, ctx.match?.entrantB].find(
        (e) => e && e.id === ctx.match?.winnerId,
      );
      const variables = {
        tournament: { name: ctx.tournament.name },
        user: { name: profile?.displayName ?? profile?.username ?? server.fallbackName },
        ...(recipient.entrant && { entrant: { name: recipient.entrant.name } }),
        ...(recipient.opponent && { opponent: { name: recipient.opponent.name } }),
        ...(winner && { winner: { name: winner.name } }),
        ...(ctx.match && {
          match: {
            scheduled_at: formatWhen(ctx.match.scheduledAt, locale, ctx.tournament.timezone),
          },
        }),
        ...(ctx.entrant?.reason && { reason: ctx.entrant.reason }),
      };
      const render = (channel: NotificationChannel) => {
        const template = pickTemplate(templates, ctx.organization.id, type.key, channel, locale);
        return {
          channel,
          subject: clip(renderTemplate(template?.subject ?? '', variables).text, 200),
          body: clip(renderTemplate(template?.body ?? '', variables).text, 4000),
        };
      };
      const inApp = render('in_app');
      if (!inApp.subject) continue;
      items.push({
        userId: recipient.userId,
        typeKey: type.key,
        title: inApp.subject,
        body: inApp.body,
        link: linkOf(type.key, type.audience, {
          tournamentId: ctx.tournament.id,
          tournamentSlug: ctx.tournament.slug,
          matchId: ctx.match?.id ?? null,
        }),
        data: {
          eventType: event.eventType,
          tournamentId: ctx.tournament.id,
          ...(ctx.match && { matchId: ctx.match.id }),
          ...(ctx.entrant && { entrantId: ctx.entrant.id }),
        },
        deliveries: channels.map((c) => (c === 'in_app' ? inApp : render(c))),
      });
    }
    return deps.notifications.enqueue(event.id, items);
  }
}

const PARALLEL_AGGREGATES = 4;

/**
 * One worker pass over the outbox: due events, each one retried with backoff
 * when it fails. Events of the same aggregate run in order; different
 * aggregates run side by side.
 */
export class ProcessOutboxUseCase {
  private readonly process: ProcessEventUseCase;

  constructor(private readonly deps: NotificationsDeps) {
    this.process = new ProcessEventUseCase(deps);
  }

  async execute(): Promise<{ processed: number; failed: number }> {
    const events = (await this.deps.notifications.claimEvents(this.deps.settings.batchSize, 120))
      // In the order they happened (the claim does not guarantee one).
      .sort(
        (a, b) =>
          a.occurredAt.getTime() - b.occurredAt.getTime() ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
    const catalog = new CatalogCache(this.deps);
    const groups = [...Map.groupBy(events, (e) => e.aggregateId).values()];
    let failed = 0;
    const runGroup = async (group: readonly OutboxEvent[]) => {
      for (const event of group) {
        try {
          await this.process.execute(event, catalog);
        } catch (error) {
          failed += 1;
          await this.deps.notifications.failEvent(
            event.id,
            errorText(error),
            nextAttemptAt(event.attempts + 1, this.deps.clock.now()),
          );
        }
      }
    };
    const workers = Array.from({ length: PARALLEL_AGGREGATES }, async () => {
      for (let group = groups.shift(); group; group = groups.shift()) await runGroup(group);
    });
    await Promise.all(workers);
    return { processed: events.length - failed, failed };
  }
}

/** Sends the queued deliveries through their channel; retries the failures with backoff. */
export class DispatchDeliveriesUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(): Promise<{ sent: number; retried: number; failed: number }> {
    const { deps } = this;
    const deliveries = await deps.notifications.claimDeliveries(deps.settings.batchSize, 120);
    const result = { sent: 0, retried: 0, failed: 0 };
    for (const delivery of deliveries) {
      const adapter = deps.channels.find((c) => c.channel === delivery.channel);
      const attempts = delivery.attempts + 1;
      try {
        if (!adapter?.available) throw new ChannelSendError('channel_unavailable', false);
        const { providerMessageId } = await adapter.send(delivery);
        await deps.notifications.updateDelivery(delivery.id, {
          status: 'sent',
          attempts,
          lastError: null,
          nextAttemptAt: null,
          providerMessageId,
          sentAt: deps.clock.now(),
        });
        result.sent += 1;
      } catch (error) {
        const retryable = !(error instanceof ChannelSendError) || error.retryable;
        const next = retryable ? nextAttemptAt(attempts, deps.clock.now()) : null;
        await deps.notifications.updateDelivery(delivery.id, {
          status: next ? 'queued' : 'failed',
          attempts,
          lastError: errorText(error),
          nextAttemptAt: next,
          providerMessageId: null,
          sentAt: null,
        });
        if (next) result.retried += 1;
        else result.failed += 1;
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export class GetInboxUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string, query: InboxQuery): Promise<Inbox> {
    const [items, unreadCount, types] = await Promise.all([
      this.deps.notifications.inbox(userId, query),
      this.deps.notifications.unreadCount(userId),
      this.deps.notifications.types(),
    ]);
    const category = new Map(types.map((t) => [t.key, t.category]));
    return {
      items: items.map((n) => ({
        id: n.id,
        typeKey: n.typeKey,
        category: category.get(n.typeKey) ?? 'tournaments',
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
      nextCursor: items.length === query.limit ? (items[items.length - 1]?.id ?? null) : null,
    };
  }
}

export class GetUnreadCountUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string): Promise<UnreadCount> {
    return { unreadCount: await this.deps.notifications.unreadCount(userId) };
  }
}

export class MarkNotificationReadUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  /** One notification (`null`: all of them). Another user's id is "not found". */
  async execute(userId: string, notificationId: string | null): Promise<UnreadCount> {
    const ids = notificationId ? [notificationId] : null;
    const matched = await this.deps.notifications.markRead(userId, ids, this.deps.clock.now());
    if (ids && matched === 0) throw notFound('notification_not_found');
    return { unreadCount: await this.deps.notifications.unreadCount(userId) };
  }
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

async function preferencesView(
  deps: NotificationsDeps,
  userId: string,
): Promise<NotificationPreferences> {
  const [types, preferences, staff] = await Promise.all([
    deps.notifications.types(),
    deps.notifications.preferencesOf([userId]),
    deps.staff.isStaff(userId),
  ]);
  const visible = [...types]
    .sort((a, b) => a.position - b.position)
    .filter((t) => staff || t.category !== 'staff');
  return {
    categories: preferenceMatrix({
      types: visible,
      preferences: preferences.get(userId) ?? [],
      available: availableChannels(deps),
    }).map((row) => ({ ...row, channels: [...row.channels] })),
  };
}

export class GetNotificationPreferencesUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  execute(userId: string): Promise<NotificationPreferences> {
    return preferencesView(this.deps, userId);
  }
}

export class UpdateNotificationPreferencesUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string, input: UpdatePreferencesRequest): Promise<NotificationPreferences> {
    const available = availableChannels(this.deps);
    for (const item of input.items) {
      if (!available.includes(item.channel))
        throw new ApplicationError('invalid', 'channel_unavailable');
      if (item.channel === 'in_app' && !isOptInCategory(item.category))
        throw new ApplicationError('invalid', 'preference_locked');
    }
    await this.deps.notifications.savePreferences(userId, input.items);
    return preferencesView(this.deps, userId);
  }
}

// ---------------------------------------------------------------------------
// Admin: types, rules and templates
// ---------------------------------------------------------------------------

async function adminTypes(deps: NotificationsDeps, organizationId: string) {
  const [types, rules, templates] = await Promise.all([
    deps.notifications.types(),
    deps.notifications.rules(organizationId, null),
    deps.notifications.templates(organizationId),
  ]);
  const view = (type: NotificationTypeRecord): AdminNotificationType => {
    const rule = ruleFor(rules, type.key, null);
    return {
      key: type.key,
      category: type.category,
      critical: type.critical,
      audience: type.audience,
      defaultChannels: [...type.defaultChannels],
      enabled: type.critical || (rule?.enabled ?? true),
      channels: [...(rule?.channels ?? type.defaultChannels)],
      hasRule: rule !== null,
      customized: [
        ...new Set(
          templates
            .filter((t) => t.organizationId === organizationId && t.typeKey === type.key)
            .map((t) => t.channel),
        ),
      ],
    };
  };
  return { types: [...types].sort((a, b) => a.position - b.position), view, templates };
}

async function loadType(deps: NotificationsDeps, typeKey: string) {
  const type = (await deps.notifications.types()).find((t) => t.key === typeKey);
  if (!type) throw notFound('notification_type_not_found');
  return type;
}

function unknownVariables(type: NotificationTypeRecord, subject: string, body: string): string[] {
  const known = new Set(variablesOf(type.key, type.audience));
  return templateVariables(`${subject}\n${body}`).filter((v) => !known.has(v));
}

async function typeDetail(
  deps: NotificationsDeps,
  organizationId: string,
  typeKey: string,
): Promise<AdminNotificationTypeDetail> {
  const type = await loadType(deps, typeKey);
  const { view, templates } = await adminTypes(deps, organizationId);
  const editable = availableChannels(deps);
  return {
    type: view(type),
    templates: editable.map((channel): NotificationTemplate => {
      const own = templates.find(
        (t) =>
          t.organizationId === organizationId &&
          t.typeKey === typeKey &&
          t.channel === channel &&
          t.locale === DEFAULT_LOCALE,
      );
      const effective = own ?? pickTemplate(templates, null, typeKey, channel, DEFAULT_LOCALE);
      return {
        typeKey,
        channel,
        locale: DEFAULT_LOCALE,
        subject: effective?.subject ?? null,
        body: effective?.body ?? '',
        variables: [...(effective?.variables ?? [])],
        version: own?.version ?? 0,
        customized: own !== undefined,
      };
    }),
    sampleVariables: Object.fromEntries(
      variablesOf(type.key, type.audience).map((v) => [v, server.samples[v] ?? v]),
    ),
  };
}

export class ListNotificationTypesUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string): Promise<AdminNotificationType[]> {
    await requireStaff(this.deps, userId);
    const { types, view } = await adminTypes(this.deps, await this.deps.organization.id());
    return types.map(view);
  }
}

export class GetNotificationTypeUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string, typeKey: string): Promise<AdminNotificationTypeDetail> {
    await requireStaff(this.deps, userId);
    return typeDetail(this.deps, await this.deps.organization.id(), typeKey);
  }
}

export class SaveNotificationRuleUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(
    userId: string,
    typeKey: string,
    input: UpdateRuleRequest,
  ): Promise<AdminNotificationTypeDetail> {
    await requireStaff(this.deps, userId);
    const type = await loadType(this.deps, typeKey);
    if (type.critical && !input.enabled) throw conflict('critical_notification');
    const organizationId = await this.deps.organization.id();
    await this.deps.notifications.saveRule(organizationId, userId, {
      typeKey,
      enabled: input.enabled,
      // In-app always goes (it is the history).
      channels: [...new Set<NotificationChannel>(['in_app', ...input.channels])],
    });
    return typeDetail(this.deps, organizationId, typeKey);
  }
}

function editableChannel(deps: NotificationsDeps, channel: NotificationChannel) {
  if (!availableChannels(deps).includes(channel))
    throw new ApplicationError('invalid', 'channel_unavailable');
}

export class SaveNotificationTemplateUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(
    userId: string,
    typeKey: string,
    channel: NotificationChannel,
    input: SaveTemplateRequest,
  ): Promise<AdminNotificationTypeDetail> {
    await requireStaff(this.deps, userId);
    const type = await loadType(this.deps, typeKey);
    editableChannel(this.deps, channel);
    const unknown = unknownVariables(type, input.subject, input.body);
    if (unknown.length > 0)
      throw new ApplicationError('invalid', 'template_unknown_variables', { variables: unknown });
    const organizationId = await this.deps.organization.id();
    await this.deps.notifications.saveTemplate(organizationId, userId, {
      typeKey,
      channel,
      locale: DEFAULT_LOCALE,
      subject: input.subject,
      body: input.body,
      variables: templateVariables(`${input.subject}\n${input.body}`),
    });
    return typeDetail(this.deps, organizationId, typeKey);
  }
}

export class ResetNotificationTemplateUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(
    userId: string,
    typeKey: string,
    channel: NotificationChannel,
  ): Promise<AdminNotificationTypeDetail> {
    await requireStaff(this.deps, userId);
    await loadType(this.deps, typeKey);
    editableChannel(this.deps, channel);
    const organizationId = await this.deps.organization.id();
    await this.deps.notifications.resetTemplate(organizationId, userId, {
      typeKey,
      channel,
      locale: DEFAULT_LOCALE,
    });
    return typeDetail(this.deps, organizationId, typeKey);
  }
}

export class PreviewNotificationTemplateUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string, input: PreviewTemplateRequest): Promise<TemplatePreview> {
    await requireStaff(this.deps, userId);
    const type = await loadType(this.deps, input.typeKey);
    const samples = nest(
      Object.fromEntries(
        variablesOf(type.key, type.audience).map((v) => [v, server.samples[v] ?? v]),
      ),
    );
    return {
      subject: renderTemplate(input.subject, samples).text,
      body: renderTemplate(input.body, samples).text,
      unknown: unknownVariables(type, input.subject, input.body),
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: delivery history
// ---------------------------------------------------------------------------

const HISTORY_PAGE = 50;

export class ListDeliveriesUseCase {
  constructor(private readonly deps: NotificationsDeps) {}

  async execute(userId: string, query: DeliveryQuery): Promise<DeliveryHistory> {
    await requireStaff(this.deps, userId);
    const since = new Date(this.deps.clock.now().getTime() - 7 * 24 * 3600_000);
    const [items, counts, outbox] = await Promise.all([
      this.deps.notifications.deliveries(query, HISTORY_PAGE),
      this.deps.notifications.deliveryCounts(since),
      this.deps.notifications.outboxCounts(),
    ]);
    const profiles = await this.deps.directory.profiles([...new Set(items.map((d) => d.userId))]);
    return {
      items: items.map((d) => ({
        id: d.id,
        typeKey: d.typeKey,
        channel: d.channel,
        status: d.status,
        subject: d.subject,
        attempts: d.attempts,
        lastError: d.lastError,
        recipient: {
          username: profiles.get(d.userId)?.username ?? null,
          displayName: profiles.get(d.userId)?.displayName ?? null,
        },
        createdAt: d.createdAt.toISOString(),
        sentAt: d.sentAt?.toISOString() ?? null,
      })),
      nextCursor: items.length === HISTORY_PAGE ? (items[items.length - 1]?.id ?? null) : null,
      counts,
      outbox,
    };
  }
}
