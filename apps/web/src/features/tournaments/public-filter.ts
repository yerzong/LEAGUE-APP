import type { PublicTournamentFilter } from '@league/contracts';

/** `?estado=` values of /torneos (Spanish URLs) and the API filter each one maps to. */
export const PUBLIC_FILTERS: readonly { slug: string; filter: PublicTournamentFilter }[] = [
  { slug: 'todos', filter: 'all' },
  { slug: 'abiertos', filter: 'open' },
  { slug: 'proximos', filter: 'upcoming' },
  { slug: 'en-curso', filter: 'live' },
  { slug: 'finalizados', filter: 'finished' },
];

export function readPublicFilter(value: string | string[] | undefined): PublicTournamentFilter {
  const slug = Array.isArray(value) ? value[0] : value;
  return PUBLIC_FILTERS.find((f) => f.slug === slug)?.filter ?? 'all';
}

export function filterHref(filter: PublicTournamentFilter): string {
  const slug = PUBLIC_FILTERS.find((f) => f.filter === filter)?.slug ?? 'todos';
  return slug === 'todos' ? '/torneos' : `/torneos?estado=${slug}`;
}
