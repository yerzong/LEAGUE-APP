import type { Locale } from '../locales.js';
import { es419, type Messages } from './es-419.js';

export type { Messages };

const catalogs: Record<Locale, Messages> = {
  'es-419': es419,
};

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}
