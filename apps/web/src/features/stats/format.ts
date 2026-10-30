import { format, plural } from '@league/i18n';

import { locale, messages } from '@/config/i18n';

const decimals = new Map<number, Intl.NumberFormat>();

/** A number with fixed decimals (`4.8`, `612`). */
export function decimal(value: number, digits = 1): string {
  let f = decimals.get(digits);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    decimals.set(digits, f);
  }
  return f.format(value);
}

const percentFormat = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
/** 0.613 → `61 %`. */
export const percent = (ratio: number) => percentFormat.format(ratio);

/** Winrate of `wins` over `games`; 0 without games. */
export const winRate = (wins: number, games: number) => (games > 0 ? wins / games : 0);

/** 1 935 s → `32:15`. */
export function duration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

export const gamesLabel = (count: number) => plural(messages.stats.games, count, locale);

export const record = (wins: number, losses: number) =>
  format(messages.stats.record, { wins: String(wins), losses: String(losses) });

const dayFormat = new Intl.DateTimeFormat(locale, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
/** `2026-10-05` → `5 oct`. */
export const shortDay = (isoDate: string) => dayFormat.format(new Date(`${isoDate}T12:00:00Z`));
