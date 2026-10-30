// The catalog and base templates of the migration, read from the SQL itself
// so the engine is tested against the texts the database really has.
import { readFileSync } from 'node:fs';

import type {
  NotificationAudience,
  NotificationCategory,
  NotificationChannel,
} from '@league/contracts';
import { templateVariables } from '@league/core';

import type { NotificationTypeRecord, TemplateRecord } from '../domain/notification.js';
import type { EventContext, RecipientDirectory, RecipientProfile } from '../application/ports.js';
import type { OutboxEvent } from '../domain/notification.js';

const MIGRATIONS = [
  '20261028090000_notifications.sql',
  // m09 adds "your team plays" for followers.
  '20261029090000_stats_achievements_follows.sql',
].map((file) => new URL(`../../../../../../supabase/migrations/${file}`, import.meta.url));

const unquote = (text: string, escaped: boolean) => {
  const plain = text.replace(/''/g, "'");
  return escaped ? plain.replace(/\\n/g, '\n') : plain;
};

export function migrationCatalog(): {
  types: NotificationTypeRecord[];
  templates: TemplateRecord[];
} {
  const sql = MIGRATIONS.map((url) => readFileSync(url, 'utf8'))
    .join('\n')
    // Later migrations spell the rows out (organization and locale first).
    .replace(/\(null, '([a-z_.]+)', '(in_app|email)', 'es-419', /g, "('$1', '$2', ")
    // …and close with the variables, which the fixture derives itself.
    .replace(/',\s*'\{[a-z_.,]*\}'\)/g, "')");
  const types = [
    ...sql.matchAll(
      /\('([a-z_.]+)', '([a-z_]+)', (true|false), '\{([a-z_,]+)\}', '([a-z_]+)', (\d+)\)/g,
    ),
  ].map((m): NotificationTypeRecord => ({
    key: m[1] as string,
    category: m[2] as NotificationCategory,
    critical: m[3] === 'true',
    defaultChannels: (m[4] as string).split(',') as NotificationChannel[],
    audience: m[5] as NotificationAudience,
    position: Number(m[6]),
  }));
  const templates = [
    ...sql.matchAll(
      /\('([a-z_.]+)', '(in_app|email)', '((?:[^']|'')*)',\s*(E?)'((?:[^']|'')*)'\)/g,
    ),
  ].map((m): TemplateRecord => {
    const subject = unquote(m[3] as string, false);
    const body = unquote(m[5] as string, m[4] === 'E');
    return {
      organizationId: null,
      typeKey: m[1] as string,
      channel: m[2] as NotificationChannel,
      locale: 'es-419',
      subject,
      body,
      variables: templateVariables(`${subject} ${body}`),
      version: 1,
    };
  });
  return { types, templates };
}

/** RecipientDirectory over plain maps the test fills. */
export class FakeRecipientDirectory implements RecipientDirectory {
  readonly contexts = new Map<string, EventContext>();
  readonly members = new Map<string, string[]>();
  readonly approved = new Map<string, { id: string; name: string }[]>();
  readonly staff = new Map<string, string[]>();
  readonly opted = new Map<NotificationCategory, string[]>();
  /** Followers by followed registration id, or by tournament id. */
  readonly followers = new Map<string, string[]>();
  readonly people = new Map<string, RecipientProfile & { email: string | null }>();

  /** Context by aggregate id (the entrant, match or tournament the event is about). */
  contextOf(event: OutboxEvent): Promise<EventContext | null> {
    return Promise.resolve(this.contexts.get(event.aggregateId) ?? null);
  }

  membersOf(entrantIds: readonly string[]): Promise<Map<string, string[]>> {
    return Promise.resolve(new Map(entrantIds.map((id) => [id, this.members.get(id) ?? []])));
  }

  approvedEntrants(tournamentId: string): Promise<{ id: string; name: string }[]> {
    return Promise.resolve(this.approved.get(tournamentId) ?? []);
  }

  staffOf(tournamentId: string): Promise<string[]> {
    return Promise.resolve(this.staff.get(tournamentId) ?? []);
  }

  followersOf(
    entrantIds: readonly string[],
    tournamentId: string,
  ): Promise<{ userId: string; entrantId: string | null }[]> {
    return Promise.resolve([
      ...entrantIds.flatMap((entrantId) =>
        (this.followers.get(entrantId) ?? []).map((userId) => ({ userId, entrantId })),
      ),
      ...(this.followers.get(tournamentId) ?? []).map((userId) => ({ userId, entrantId: null })),
    ]);
  }

  optedIn(category: NotificationCategory): Promise<string[]> {
    return Promise.resolve(this.opted.get(category) ?? []);
  }

  profiles(userIds: readonly string[]): Promise<Map<string, RecipientProfile>> {
    return Promise.resolve(
      new Map(
        userIds.flatMap((id) => {
          const p = this.people.get(id);
          return p ? [[id, p] as const] : [];
        }),
      ),
    );
  }

  emailOf(userId: string): Promise<string | null> {
    return Promise.resolve(this.people.get(userId)?.email ?? null);
  }
}
