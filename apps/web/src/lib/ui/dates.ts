import { locale } from '@/config/i18n';

const dateFormat = new Intl.DateTimeFormat(locale, {
  dateStyle: 'long',
  timeZone: 'America/Mexico_City',
});
const timeFormat = new Intl.DateTimeFormat(locale, {
  timeStyle: 'short',
  timeZone: 'America/Mexico_City',
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** Initials for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`
      : (parts[0] ?? '?').slice(0, 2)
  ).toUpperCase();
}
