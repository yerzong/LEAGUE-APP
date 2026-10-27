import { ChevronRightIcon } from 'lucide-react';

import { cn } from '../../lib/cn.js';
import { defaultRenderLink, type RenderLink } from '../../lib/link.js';

export interface BreadcrumbItem {
  label: string;
  /** Omit on the current page (the last item). */
  href?: string | undefined;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  /** Accessible name of the navigation landmark (i18n from the app). */
  label: string;
  renderLink?: RenderLink | undefined;
  className?: string | undefined;
}

export function Breadcrumbs({
  items,
  label,
  renderLink = defaultRenderLink,
  className,
}: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${String(index)}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                renderLink({
                  href: item.href,
                  className: 'rounded-xs transition-colors hover:text-text focus-ring',
                  children: item.label,
                })
              ) : (
                <span aria-current={last ? 'page' : undefined} className="truncate text-text">
                  {item.label}
                </span>
              )}
              {!last && <ChevronRightIcon aria-hidden className="size-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
