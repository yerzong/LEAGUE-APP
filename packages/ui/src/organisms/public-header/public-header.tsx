'use client';

import { MenuIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Badge } from '../../atoms/badge/badge.js';
import { Button } from '../../atoms/button/button.js';
import { cn } from '../../lib/cn.js';
import { defaultRenderLink, type RenderLink } from '../../lib/link.js';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../molecules/sheet/sheet.js';

export interface PublicNavItem {
  href: string;
  label: string;
  /** Section planned but not built yet: shown as "soon", never linked. */
  soon?: boolean | undefined;
}

export interface PublicHeaderProps {
  /** Logo block linking home (from brand configuration). */
  brand: ReactNode;
  nav: PublicNavItem[];
  /** href of the current section, to mark it as active. */
  activeHref?: string | undefined;
  labels: { navigation: string; openMenu: string; closeMenu: string; soon: string };
  /** Right side of the bar: sign-in buttons or the user menu. */
  actions?: ReactNode;
  /** Shown at the bottom of the mobile menu (e.g. both sign-in buttons). */
  menuActions?: ReactNode;
  renderLink?: RenderLink | undefined;
}

function NavItems({
  nav,
  activeHref,
  soonLabel,
  renderLink,
  onNavigate,
  layout,
}: {
  nav: PublicNavItem[];
  activeHref: string | undefined;
  soonLabel: string;
  renderLink: RenderLink;
  onNavigate: () => void;
  layout: 'bar' | 'menu';
}) {
  const bar = layout === 'bar';
  return (
    <ul className={cn(bar ? 'flex items-center gap-1' : 'flex flex-col gap-0.5')}>
      {nav.map((item) => {
        const active = item.href === activeHref;
        const base = cn(
          'flex items-center gap-2 text-sm font-semibold caps transition-colors duration-(--duration-fast)',
          bar ? 'h-16 border-b-2 px-3' : 'rounded-sm border-l-2 px-3 py-2.5',
        );
        if (item.soon) {
          return (
            <li key={item.href} className={cn(bar && 'hidden xl:block')}>
              <span
                aria-disabled="true"
                className={cn(base, 'cursor-default border-transparent text-brand-dim')}
              >
                {item.label}
                <Badge variant="outline" className="px-1.5 py-0 text-xs">
                  {soonLabel}
                </Badge>
              </span>
            </li>
          );
        }
        return (
          <li key={item.href}>
            {renderLink({
              href: item.href,
              'aria-current': active ? 'page' : undefined,
              onClick: onNavigate,
              className: cn(
                base,
                'focus-ring',
                active
                  ? 'border-brand text-text'
                  : 'border-transparent text-text-muted hover:text-text',
                !bar && active && 'bg-surface-2',
              ),
              children: item.label,
            })}
          </li>
        );
      })}
    </ul>
  );
}

/** Top bar of the public site. Presentational: the app decides what `actions` shows. */
export function PublicHeader({
  brand,
  nav,
  activeHref,
  labels,
  actions,
  menuActions,
  renderLink = defaultRenderLink,
}: PublicHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label={labels.openMenu}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen(true);
          }}
        >
          <MenuIcon />
        </Button>
        <div className="min-w-0 shrink-0">{brand}</div>
        <nav aria-label={labels.navigation} className="hidden lg:block">
          <NavItems
            nav={nav}
            activeHref={activeHref}
            soonLabel={labels.soon}
            renderLink={renderLink}
            onNavigate={closeMenu}
            layout="bar"
          />
        </nav>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" closeLabel={labels.closeMenu} className="w-72 gap-6 p-4">
          <SheetHeader className="p-0 px-3">
            <SheetTitle asChild>
              <div>{brand}</div>
            </SheetTitle>
            <SheetDescription className="sr-only">{labels.navigation}</SheetDescription>
          </SheetHeader>
          <nav aria-label={labels.navigation}>
            <NavItems
              nav={nav}
              activeHref={activeHref}
              soonLabel={labels.soon}
              renderLink={renderLink}
              onNavigate={closeMenu}
              layout="menu"
            />
          </nav>
          {menuActions && (
            <div className="mt-auto flex flex-col gap-2 border-t pt-4">{menuActions}</div>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}
