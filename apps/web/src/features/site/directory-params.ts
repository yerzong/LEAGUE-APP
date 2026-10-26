import { type DirectoryQuery, DirectoryQuerySchema } from '@league/contracts';

export const DIRECTORY_PAGE_SIZE = 24;

/**
 * Reads `?q=` and `?pagina=` from the URL. An invalid search is reported (to
 * show a hint) and replaced by an empty one, so the page never breaks.
 */
export function readDirectoryParams(params: Record<string, string | string[] | undefined>): {
  query: DirectoryQuery;
  invalid: boolean;
} {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const page = Number(first(params.pagina) ?? '1');
  const parsed = DirectoryQuerySchema.safeParse({
    q: first(params.q) ?? '',
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
    pageSize: DIRECTORY_PAGE_SIZE,
  });
  if (parsed.success) return { query: parsed.data, invalid: false };
  return { query: { q: '', page: 1, pageSize: DIRECTORY_PAGE_SIZE }, invalid: true };
}
