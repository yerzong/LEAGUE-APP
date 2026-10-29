import { EmailError, FakeEmailAdapter } from '@league/integrations';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApplicationError } from '../../../shared/application-error.js';
import {
  DiscordChannelAdapter,
  EmailChannelAdapter,
  InAppChannelAdapter,
  PushChannelAdapter,
} from '../infrastructure/channels.js';
import { InMemoryNotificationRepository } from '../testing/in-memory-notification-repository.js';
import { FakeRecipientDirectory, migrationCatalog } from '../testing/notification-fixture.js';
import type { NotificationsDeps } from './deps.js';
import {
  DispatchDeliveriesUseCase,
  GetInboxUseCase,
  GetNotificationPreferencesUseCase,
  GetNotificationTypeUseCase,
  ListDeliveriesUseCase,
  ListNotificationTypesUseCase,
  MarkNotificationReadUseCase,
  PreviewNotificationTemplateUseCase,
  ProcessOutboxUseCase,
  ResetNotificationTemplateUseCase,
  SaveNotificationRuleUseCase,
  SaveNotificationTemplateUseCase,
  UpdateNotificationPreferencesUseCase,
} from './notifications.use-cases.js';

const ORG = '00000000-0000-4000-8000-0000000000aa';
const TOURNAMENT = '00000000-0000-4000-8000-0000000000t1';
const JAGUARES = '00000000-0000-4000-8000-0000000000e1';
const QUETZALES = '00000000-0000-4000-8000-0000000000e2';
const MATCH = '00000000-0000-4000-8000-0000000000m1';
// Ana captains Jaguares with Beto; Carla captains Quetzales; Staff is a super admin.
const ANA = 'user-ana';
const BETO = 'user-beto';
const CARLA = 'user-carla';
const STAFF = 'user-staff';

class TestClock {
  current = new Date('2026-10-27T18:00:00Z');
  now() {
    return this.current;
  }
  advance(seconds: number) {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

let clock: TestClock;
let repo: InMemoryNotificationRepository;
let directory: FakeRecipientDirectory;
let email: FakeEmailAdapter;
let deps: NotificationsDeps;

const tournament = {
  id: TOURNAMENT,
  name: 'Liga Apertura',
  slug: 'liga-apertura',
  timezone: 'America/Mexico_City',
};
const organization = { id: ORG, name: 'Liga de prueba' };

beforeEach(() => {
  clock = new TestClock();
  const catalog = migrationCatalog();
  repo = new InMemoryNotificationRepository(clock, catalog.types, catalog.templates);
  directory = new FakeRecipientDirectory();
  email = new FakeEmailAdapter();
  for (const [id, displayName] of [
    [ANA, 'Ana'],
    [BETO, 'Beto'],
    [CARLA, 'Carla'],
    [STAFF, null],
  ] as const)
    directory.people.set(id, {
      username: id.replace('user-', ''),
      displayName,
      locale: 'es-419',
      email: `${id}@example.com`,
    });
  directory.members.set(JAGUARES, [ANA, BETO]);
  directory.members.set(QUETZALES, [CARLA]);
  directory.staff.set(TOURNAMENT, [STAFF]);
  directory.contexts.set(JAGUARES, {
    organization,
    tournament,
    entrant: { id: JAGUARES, name: 'Jaguares', reason: null },
    match: null,
  });
  directory.contexts.set(MATCH, {
    organization,
    tournament,
    entrant: null,
    match: {
      id: MATCH,
      scheduledAt: new Date('2026-10-31T00:00:00Z'),
      entrantA: { id: JAGUARES, name: 'Jaguares' },
      entrantB: { id: QUETZALES, name: 'Quetzales' },
      winnerId: QUETZALES,
    },
  });
  deps = {
    notifications: repo,
    directory,
    channels: [
      new InAppChannelAdapter(),
      new EmailChannelAdapter({
        email,
        directory,
        organizationName: () => Promise.resolve(organization.name),
        webOrigin: 'https://liga.example',
      }),
      new DiscordChannelAdapter(),
      new PushChannelAdapter(),
    ],
    staff: { isStaff: (id) => Promise.resolve(id === STAFF) },
    organization: { id: () => Promise.resolve(ORG) },
    clock,
    settings: { maxEventAgeHours: 48, batchSize: 25 },
  };
});

const approve = (entrantId = JAGUARES) =>
  repo.emit({
    organizationId: ORG,
    aggregateType: 'entrant',
    aggregateId: entrantId,
    eventType: 'registration.approved',
    payload: { tournament_id: TOURNAMENT, from: 'pending', to: 'approved' },
  });

const matchEvent = (eventType: string) =>
  repo.emit({
    organizationId: ORG,
    aggregateType: 'match',
    aggregateId: MATCH,
    eventType,
    payload: { tournament_id: TOURNAMENT },
  });

const work = async () => {
  await new ProcessOutboxUseCase(deps).execute();
  return new DispatchDeliveriesUseCase(deps).execute();
};

const inboxOf = (userId: string) =>
  new GetInboxUseCase(deps).execute(userId, { limit: 20, unread: false });

describe('engine: an approved registration', () => {
  it('notifies the captain and the roster in-app and by email', async () => {
    approve();
    const sent = await work();

    expect(sent).toEqual({ sent: 2, retried: 0, failed: 0 });
    for (const user of [ANA, BETO]) {
      const inbox = await inboxOf(user);
      expect(inbox.unreadCount).toBe(1);
      expect(inbox.items[0]).toMatchObject({
        typeKey: 'registration.approved',
        category: 'tournaments',
        title: 'Inscripción aprobada',
        body: 'Jaguares ya está dentro de Liga Apertura.',
        link: '/app/torneos/liga-apertura',
        readAt: null,
      });
    }
    expect((await inboxOf(CARLA)).items).toEqual([]);

    expect(email.sent.map((m) => m.to).sort()).toEqual([
      'user-ana@example.com',
      'user-beto@example.com',
    ]);
    const toAna = email.sent.find((m) => m.to === 'user-ana@example.com');
    expect(toAna?.subject).toBe('Jaguares está dentro de Liga Apertura');
    expect(toAna?.text).toContain('Hola, Ana:');
    expect(toAna?.text).toContain('https://liga.example/app/torneos/liga-apertura');
    expect(toAna?.text).toContain('Recibes este correo por tu cuenta en Liga de prueba');
    expect(toAna?.html).toContain('href="https://liga.example/app/torneos/liga-apertura"');
  });

  it('does not duplicate anything when the event is processed twice', async () => {
    const eventId = approve();
    await work();
    // A second worker (or a retry after a crash) gets the same event again.
    const event = repo.events.find((e) => e.id === eventId);
    if (event) event.publishedAt = null;
    await work();

    expect(repo.notifications).toHaveLength(2);
    expect(repo.deliveriesTable).toHaveLength(4);
    expect(email.sent).toHaveLength(2);
    expect((await inboxOf(ANA)).unreadCount).toBe(1);
  });

  it('marks the event published and leaves no work behind', async () => {
    const eventId = approve();
    await work();
    expect(repo.events.find((e) => e.id === eventId)?.publishedAt).not.toBeNull();
    expect(await new ProcessOutboxUseCase(deps).execute()).toEqual({ processed: 0, failed: 0 });
  });
});

describe('engine: rules, preferences and critical notifications', () => {
  it('drops the email of a user who turned it off for the category', async () => {
    await new UpdateNotificationPreferencesUseCase(deps).execute(BETO, {
      items: [{ category: 'tournaments', channel: 'email', enabled: false }],
    });
    approve();
    await work();
    expect(email.sent.map((m) => m.to)).toEqual(['user-ana@example.com']);
    expect((await inboxOf(BETO)).unreadCount).toBe(1);
  });

  it('cannot turn a critical notification off: a forfeit still emails', async () => {
    await new UpdateNotificationPreferencesUseCase(deps).execute(CARLA, {
      items: [{ category: 'matches', channel: 'email', enabled: false }],
    });
    matchEvent('match.forfeited');
    await work();

    expect((await inboxOf(CARLA)).items[0]).toMatchObject({
      typeKey: 'match.forfeit',
      body: 'Se aplicó forfeit en Quetzales vs Jaguares. Ganador: Quetzales.',
      link: `/app/partidas/${MATCH}`,
    });
    expect(email.sent.map((m) => m.to)).toContain('user-carla@example.com');
  });

  it('follows the organization rule, which cannot disable a critical type', async () => {
    await new SaveNotificationRuleUseCase(deps).execute(STAFF, 'registration.approved', {
      enabled: false,
      channels: ['in_app'],
    });
    approve();
    await work();
    expect(repo.notifications).toEqual([]);

    await expect(
      new SaveNotificationRuleUseCase(deps).execute(STAFF, 'match.forfeit', {
        enabled: false,
        channels: ['in_app'],
      }),
    ).rejects.toMatchObject({ code: 'critical_notification' });
  });

  it('never queues Discord or push (registered, not available yet)', async () => {
    matchEvent('match.completed');
    await work();
    expect(repo.deliveriesTable.map((d) => d.channel)).toEqual(['in_app', 'in_app', 'in_app']);
    expect((await inboxOf(ANA)).items[0]?.body).toBe('Jaguares vs Quetzales: ganó Quetzales.');
  });

  it('gives each side of a match its own point of view and the local time', async () => {
    matchEvent('match.rescheduled');
    await work();
    expect((await inboxOf(ANA)).items[0]?.body).toBe(
      'Jaguares vs Quetzales se movió a viernes, 30 de octubre, 18:00.',
    );
    expect((await inboxOf(CARLA)).items[0]?.body).toBe(
      'Quetzales vs Jaguares se movió a viernes, 30 de octubre, 18:00.',
    );
  });

  it('sends one notification per user and event: staff on a dispute', async () => {
    directory.staff.set(TOURNAMENT, [STAFF, ANA]);
    matchEvent('dispute.opened');
    await work();
    // Ana is a party: she gets the party notification, not the staff one.
    expect(repo.notifications.filter((n) => n.userId === ANA).map((n) => n.typeKey)).toEqual([
      'dispute.opened',
    ]);
    expect((await inboxOf(STAFF)).items[0]).toMatchObject({
      typeKey: 'staff.dispute_opened',
      link: `/admin/torneos/${TOURNAMENT}/partidas/${MATCH}`,
    });
  });

  it('announcements reach only the users who opted in', async () => {
    directory.contexts.set(TOURNAMENT, { organization, tournament, entrant: null, match: null });
    directory.opted.set('announcements', [CARLA]);
    repo.emit({
      organizationId: ORG,
      aggregateType: 'tournament',
      aggregateId: TOURNAMENT,
      eventType: 'tournament.published',
      payload: {},
    });
    await new UpdateNotificationPreferencesUseCase(deps).execute(CARLA, {
      items: [{ category: 'announcements', channel: 'in_app', enabled: true }],
    });
    await work();
    expect(repo.notifications.map((n) => [n.userId, n.title])).toEqual([
      [CARLA, 'Nuevo torneo: Liga Apertura'],
    ]);
  });

  it('uses the organization template over the base one', async () => {
    await new SaveNotificationTemplateUseCase(deps).execute(
      STAFF,
      'registration.approved',
      'in_app',
      {
        subject: '¡Adentro!',
        body: '{{entrant.name}} juega {{tournament.name}}.',
      },
    );
    approve();
    await work();
    expect((await inboxOf(ANA)).items[0]).toMatchObject({
      title: '¡Adentro!',
      body: 'Jaguares juega Liga Apertura.',
    });
  });

  it('ignores events nobody listens to and stale ones', async () => {
    matchEvent('match.checked_in');
    repo.emit({
      organizationId: ORG,
      aggregateType: 'entrant',
      aggregateId: JAGUARES,
      eventType: 'registration.approved',
      payload: {},
      occurredAt: new Date('2026-10-01T00:00:00Z'),
    });
    await work();
    expect(repo.notifications).toEqual([]);
    expect(repo.events.every((e) => e.publishedAt !== null)).toBe(true);
  });
});

describe('retries', () => {
  it('retries a failing event with backoff and dead-letters it at the end', async () => {
    const eventId = approve();
    directory.contextOf = () => Promise.reject(new Error('database unavailable'));

    expect(await new ProcessOutboxUseCase(deps).execute()).toEqual({ processed: 0, failed: 1 });
    const event = () => repo.events.find((e) => e.id === eventId);
    expect(event()?.attempts).toBe(1);
    expect(event()?.nextAttemptAt?.toISOString()).toBe('2026-10-27T18:00:30.000Z');
    // Not due yet.
    expect(await new ProcessOutboxUseCase(deps).execute()).toEqual({ processed: 0, failed: 0 });

    for (let i = 0; i < 5; i++) {
      clock.advance(3600);
      await new ProcessOutboxUseCase(deps).execute();
    }
    expect(event()?.dead).toBe(true);
    expect(event()?.lastError).toBe('Error: database unavailable');
  });

  it('requeues an email the provider could not take, and fails a rejected one', async () => {
    email.failNext(new EmailError('unavailable', 503), new EmailError('rejected', 422));
    approve();
    expect(await work()).toEqual({ sent: 0, retried: 1, failed: 1 });

    const failed = repo.deliveriesTable.find((d) => d.status === 'failed');
    expect(failed?.lastError).toBe('ChannelSendError: email_rejected');
    const queued = repo.deliveriesTable.find((d) => d.channel === 'email' && d.status === 'queued');
    expect(queued?.attempts).toBe(1);

    clock.advance(30);
    expect(await new DispatchDeliveriesUseCase(deps).execute()).toEqual({
      sent: 1,
      retried: 0,
      failed: 0,
    });
    expect(email.sent).toHaveLength(1);
  });
});

describe('inbox', () => {
  it('marks one or all notifications read, only the user’s own', async () => {
    approve();
    matchEvent('match.completed');
    await work();
    const inbox = await inboxOf(ANA);
    expect(inbox.unreadCount).toBe(2);
    const [latest] = inbox.items;

    const mark = new MarkNotificationReadUseCase(deps);
    expect(await mark.execute(ANA, latest?.id ?? null)).toEqual({ unreadCount: 1 });
    await expect(mark.execute(CARLA, latest?.id ?? null)).rejects.toMatchObject({
      code: 'notification_not_found',
    });
    expect(await mark.execute(ANA, null)).toEqual({ unreadCount: 0 });
    // Marking an already read notification is fine.
    expect(await mark.execute(ANA, latest?.id ?? null)).toEqual({ unreadCount: 0 });
  });

  it('pages from the newest', async () => {
    approve();
    matchEvent('match.completed');
    await work();
    const first = await new GetInboxUseCase(deps).execute(ANA, { limit: 1, unread: false });
    expect(first.items[0]?.typeKey).toBe('match.result_confirmed');
    const second = await new GetInboxUseCase(deps).execute(ANA, {
      limit: 1,
      unread: false,
      before: first.nextCursor ?? undefined,
    });
    expect(second.items[0]?.typeKey).toBe('registration.approved');
  });
});

describe('preferences', () => {
  it('lists the categories by channel; staff ones only for staff', async () => {
    const view = await new GetNotificationPreferencesUseCase(deps).execute(ANA);
    expect(view.categories.map((c) => c.category)).toEqual([
      'tournaments',
      'matches',
      'announcements',
    ]);
    expect(view.categories[1]).toEqual({
      category: 'matches',
      optIn: false,
      hasCritical: true,
      channels: [
        { channel: 'in_app', enabled: true, locked: true },
        { channel: 'email', enabled: true, locked: false },
      ],
    });
    const staff = await new GetNotificationPreferencesUseCase(deps).execute(STAFF);
    expect(staff.categories.map((c) => c.category)).toContain('staff');
  });

  it('rejects turning the history off or an unavailable channel', async () => {
    const update = new UpdateNotificationPreferencesUseCase(deps);
    await expect(
      update.execute(ANA, { items: [{ category: 'matches', channel: 'in_app', enabled: false }] }),
    ).rejects.toMatchObject({ code: 'preference_locked' });
    await expect(
      update.execute(ANA, { items: [{ category: 'matches', channel: 'discord', enabled: true }] }),
    ).rejects.toMatchObject({ code: 'channel_unavailable' });
  });
});

describe('admin', () => {
  it('is for staff only', async () => {
    await expect(new ListNotificationTypesUseCase(deps).execute(ANA)).rejects.toBeInstanceOf(
      ApplicationError,
    );
  });

  it('lists the catalog with the rule and customized templates', async () => {
    await new SaveNotificationRuleUseCase(deps).execute(STAFF, 'registration.received', {
      enabled: true,
      channels: ['email'],
    });
    const types = await new ListNotificationTypesUseCase(deps).execute(STAFF);
    expect(types).toHaveLength(18);
    expect(types.find((t) => t.key === 'registration.received')).toMatchObject({
      enabled: true,
      channels: ['in_app', 'email'],
      hasRule: true,
      customized: [],
    });
    expect(repo.audit.map((a) => a.action)).toEqual(['notification_rule.updated']);
  });

  it('edits a template with a preview, rejects unknown variables and restores the base', async () => {
    const preview = await new PreviewNotificationTemplateUseCase(deps).execute(STAFF, {
      typeKey: 'registration.rejected',
      channel: 'email',
      subject: 'Rechazo de {{entrant.name}}',
      body: 'Motivo: {{reason}} {{match.code}}',
    });
    expect(preview).toEqual({
      subject: 'Rechazo de Jaguares',
      body: 'Motivo: El roster no cumple el rango máximo. ',
      unknown: ['match.code'],
    });

    const save = new SaveNotificationTemplateUseCase(deps);
    await expect(
      save.execute(STAFF, 'registration.rejected', 'email', {
        subject: 'x',
        body: '{{match.code}}',
      }),
    ).rejects.toMatchObject({ code: 'template_unknown_variables' });

    const saved = await save.execute(STAFF, 'registration.rejected', 'email', {
      subject: 'Rechazo de {{entrant.name}}',
      body: 'Motivo: {{reason}}',
    });
    const emailTemplate = saved.templates.find((t) => t.channel === 'email');
    expect(emailTemplate).toMatchObject({
      customized: true,
      version: 1,
      variables: ['entrant.name', 'reason'],
    });
    expect(saved.type.customized).toEqual(['email']);

    const reset = await new ResetNotificationTemplateUseCase(deps).execute(
      STAFF,
      'registration.rejected',
      'email',
    );
    expect(reset.templates.find((t) => t.channel === 'email')).toMatchObject({
      customized: false,
      subject: 'La inscripción de {{entrant.name}} fue rechazada',
    });
  });

  it('shows the templates of the available channels, email falling back to in-app text', async () => {
    const detail = await new GetNotificationTypeUseCase(deps).execute(STAFF, 'match.checkin_open');
    expect(detail.templates.map((t) => [t.channel, t.subject])).toEqual([
      ['in_app', 'Check-in abierto'],
      ['email', 'Check-in abierto'],
    ]);
    expect(Object.keys(detail.sampleVariables)).toContain('opponent.name');
  });

  it('shows the delivery history with counts and the outbox backlog', async () => {
    email.failNext(new EmailError('rejected', 422));
    approve();
    await work();
    matchEvent('match.completed');

    const history = await new ListDeliveriesUseCase(deps).execute(STAFF, {});
    expect(history.items).toHaveLength(4);
    expect(history.counts).toEqual({ queued: 0, sent: 1, delivered: 2, failed: 1 });
    expect(history.outbox).toEqual({ pending: 1, dead: 0 });
    const failed = await new ListDeliveriesUseCase(deps).execute(STAFF, { status: 'failed' });
    expect(failed.items[0]).toMatchObject({
      channel: 'email',
      typeKey: 'registration.approved',
      lastError: 'ChannelSendError: email_rejected',
    });
    expect(failed.items[0]?.recipient.username).toMatch(/ana|beto/);
  });
});
