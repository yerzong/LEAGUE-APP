import { DEFAULT_LOCALE, type Locale } from './locales.js';

/** Message pair for counted things: `{ one: '{count} equipo', other: '{count} equipos' }`. */
export interface PluralMessage {
  readonly one: string;
  readonly other: string;
}

/** Picks the plural form for `count` and fills `{count}` (formatted for the locale). */
export function plural(message: PluralMessage, count: number, locale: Locale = DEFAULT_LOCALE) {
  const form = new Intl.PluralRules(locale).select(count) === 'one' ? message.one : message.other;
  return form.replace('{count}', new Intl.NumberFormat(locale).format(count));
}
