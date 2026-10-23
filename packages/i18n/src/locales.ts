export const LOCALES = ['es-419'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'es-419';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
