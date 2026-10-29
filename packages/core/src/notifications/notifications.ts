// Notification decisions (docs/15 §4–5): which channels a notification goes
// through after the organization rule and the user's preferences, the
// preference matrix the portal shows, template rendering and retry backoff.

export type NotificationChannel = 'in_app' | 'email' | 'discord' | 'push';
export type NotificationCategory =
  'tournaments' | 'matches' | 'team' | 'staff' | 'announcements' | 'marketing';

export interface NotificationTypeDef {
  readonly key: string;
  readonly category: NotificationCategory;
  /** Match code, forfeit, sanction: cannot be turned off, only moved to another channel. */
  readonly critical: boolean;
  readonly defaultChannels: readonly NotificationChannel[];
}

export interface NotificationRuleDef {
  readonly enabled: boolean;
  /** `null`: the type's default channels. */
  readonly channels: readonly NotificationChannel[] | null;
}

export interface ChannelPreference {
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

const OPT_IN: ReadonlySet<NotificationCategory> = new Set(['announcements', 'marketing']);

/** Announcements and marketing need an explicit opt-in (docs/15 §4), in-app included. */
export const isOptInCategory = (category: NotificationCategory): boolean => OPT_IN.has(category);

function preferenceOf(
  preferences: readonly ChannelPreference[],
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  const found = preferences.find((p) => p.category === category && p.channel === channel);
  return found ? found.enabled : !isOptInCategory(category);
}

/**
 * Channels for one recipient, in-app first; empty means "do not notify".
 * `available` are the channels the platform can send through today.
 */
export function decideChannels(input: {
  type: NotificationTypeDef;
  rule: NotificationRuleDef | null;
  preferences: readonly ChannelPreference[];
  available: readonly NotificationChannel[];
}): NotificationChannel[] {
  const { type, rule, preferences, available } = input;
  if (rule && !rule.enabled && !type.critical) return [];
  const allowed = (rule?.channels ?? type.defaultChannels).filter(
    (c) => c !== 'in_app' && available.includes(c),
  );
  const external = allowed.filter((c) => preferenceOf(preferences, type.category, c));
  // Critical: if the user turned every allowed channel off, the first one stays.
  if (type.critical && external.length === 0 && allowed[0]) external.push(allowed[0]);
  const inApp = isOptInCategory(type.category)
    ? preferenceOf(preferences, type.category, 'in_app')
    : true;
  return [...(inApp ? (['in_app'] as const) : []), ...external];
}

export interface PreferenceRow {
  readonly category: NotificationCategory;
  readonly optIn: boolean;
  readonly hasCritical: boolean;
  readonly channels: readonly {
    readonly channel: NotificationChannel;
    readonly enabled: boolean;
    /** In-app is the history outside opt-in categories: always on. */
    readonly locked: boolean;
  }[];
}

/** What the preferences page shows: the categories of `types`, in order, by available channel. */
export function preferenceMatrix(input: {
  types: readonly NotificationTypeDef[];
  preferences: readonly ChannelPreference[];
  available: readonly NotificationChannel[];
}): PreferenceRow[] {
  const categories = [...new Set(input.types.map((t) => t.category))];
  return categories.map((category) => {
    const optIn = isOptInCategory(category);
    return {
      category,
      optIn,
      hasCritical: input.types.some((t) => t.category === category && t.critical),
      channels: input.available.map((channel) => {
        const locked = channel === 'in_app' && !optIn;
        return {
          channel,
          enabled: locked || preferenceOf(input.preferences, category, channel),
          locked,
        };
      }),
    };
  });
}

const PLACEHOLDER = /\{\{\s*([a-z_]+(?:\.[a-z_]+)*)\s*\}\}/g;

function lookup(variables: Readonly<Record<string, unknown>>, path: string): string | null {
  let value: unknown = variables;
  for (const part of path.split('.')) {
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, part)) return null;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** Replaces `{{a.b}}` with the variables (text and numbers only); unknown ones render empty. */
export function renderTemplate(
  template: string,
  variables: Readonly<Record<string, unknown>>,
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(PLACEHOLDER, (_, path: string) => {
    const value = lookup(variables, path);
    if (value === null) missing.add(path);
    return value ?? '';
  });
  return { text, missing: [...missing].sort() };
}

/** The variables a template uses, sorted and unique. */
export function templateVariables(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1] as string))].sort();
}

export const DEFAULT_MAX_ATTEMPTS = 6;
const BASE_DELAY_SECONDS = 30;
const MAX_DELAY_SECONDS = 3600;

/**
 * When to retry after `attempts` failures: 30 s, 1 min, 2 min… up to an hour;
 * `null` once `maxAttempts` is reached (dead letter).
 */
export function nextAttemptAt(
  attempts: number,
  now: Date,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Date | null {
  if (attempts >= maxAttempts) return null;
  const delay = Math.min(BASE_DELAY_SECONDS * 2 ** Math.max(attempts - 1, 0), MAX_DELAY_SECONDS);
  return new Date(now.getTime() + delay * 1000);
}
