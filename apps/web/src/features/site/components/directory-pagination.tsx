import { format } from '@league/i18n';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@league/ui';

import { messages } from '@/config/i18n';

const t = messages.pagination;

function pageHref(base: string, query: string, page: number): string {
  const params = new URLSearchParams();
  if (query !== '') params.set('q', query);
  if (page > 1) params.set('pagina', String(page));
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

export function DirectoryPagination({
  base,
  query,
  page,
  pageSize,
  total,
}: {
  base: string;
  query: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;

  return (
    <Pagination label={t.label}>
      <PaginationContent className="gap-3">
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious label={t.previous} href={pageHref(base, query, page - 1)} />
          </PaginationItem>
        )}
        <PaginationItem>
          <span className="text-sm text-text-muted tabular">
            {format(t.status, { page, pages })}
          </span>
        </PaginationItem>
        {page < pages && (
          <PaginationItem>
            <PaginationNext label={t.next} href={pageHref(base, query, page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
