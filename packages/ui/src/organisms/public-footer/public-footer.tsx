import type { ReactNode } from 'react';

import { Badge } from '../../atoms/badge/badge.js';
import { cn } from '../../lib/cn.js';
import { defaultRenderLink, type RenderLink } from '../../lib/link.js';

export interface FooterLink {
  label: string;
  /** Omit for a placeholder (shown with the "soon" label, never linked). */
  href?: string | undefined;
  external?: boolean | undefined;
}

export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

export interface PublicFooterProps {
  brand: ReactNode;
  /** One line about the league under the logo. */
  tagline?: string | undefined;
  groups: FooterGroup[];
  /** Legal notice shown in full (e.g. the Riot Games disclaimer). */
  disclaimer: string;
  /** Bottom line (copyright). */
  legalLine?: string | undefined;
  labels: { navigation: string; soon: string };
  renderLink?: RenderLink | undefined;
}

const linkClass = 'rounded-xs text-sm text-text-muted transition-colors hover:text-text focus-ring';

export function PublicFooter({
  brand,
  tagline,
  groups,
  disclaimer,
  legalLine,
  labels,
  renderLink = defaultRenderLink,
}: PublicFooterProps) {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div className="flex flex-col gap-3">
            {brand}
            {tagline && <p className="max-w-xs text-sm text-text-muted">{tagline}</p>}
          </div>
          <nav aria-label={labels.navigation} className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-brand-dim caps">{group.title}</p>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.href ? (
                        renderLink({
                          href: link.href,
                          className: linkClass,
                          children: link.label,
                          ...(link.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {}),
                        })
                      ) : (
                        <span
                          aria-disabled="true"
                          className={cn(linkClass, 'flex items-center gap-2 hover:text-text-muted')}
                        >
                          {link.label}
                          <Badge variant="outline" className="px-1.5 py-0 text-xs">
                            {labels.soon}
                          </Badge>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-t pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-text-muted">{disclaimer}</p>
          {legalLine && <p className="text-xs text-brand-dim">{legalLine}</p>}
        </div>
      </div>
    </footer>
  );
}
