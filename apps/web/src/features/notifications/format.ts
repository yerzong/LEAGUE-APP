import { locale } from '@/config/i18n';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "hace 5 minutos", "hace 2 días"; a week or more shows the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) >= 7 * 86_400)
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS)
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return rtf.format(0, 'minute');
}

/** Dates of the delivery monitor, in the organization's time zone. */
export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}
