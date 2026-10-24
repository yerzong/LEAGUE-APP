'use client';

import { MenuIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Button } from '../../atoms/button/button.js';
import { cn } from '../../lib/cn.js';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../molecules/sheet/sheet.js';

export interface AppShellNavItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export interface AppShellProps {
  /** Logo / name block at the top of the sidebar (from brand configuration). */
  brand: ReactNode;
  /** Zone name shown in the top bar ("Consola", "Portal"). */
  title: string;
  nav: AppShellNavItem[];
  /** href of the current section, to mark it as active. */
  activeHref?: string | undefined;
  labels: { navigation: string; openMenu: string; closeMenu: string };
  /** Right side of the top bar (user menu, sign out). */
  actions?: ReactNode;
  /** Lets the app use its router link (e.g. next/link); defaults to <a>. */
  renderLink?: ((item: AppShellNavItem, props: NavLinkProps) => ReactNode) | undefined;
  children: ReactNode;
}

export interface NavLinkProps {
  className: string;
  'aria-current': 'page' | undefined;
  onClick: () => void;
  children: ReactNode;
}

function NavList({
  nav,
  activeHref,
  label,
  renderLink,
  onNavigate,
}: Pick<AppShellProps, 'nav' | 'activeHref' | 'renderLink'> & {
  label: string;
  onNavigate: () => void;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = item.href === activeHref;
          const props: NavLinkProps = {
            className: cn(
              'flex items-center gap-3 rounded-sm border-l-2 px-3 py-2 text-sm font-medium transition-colors duration-(--duration-fast) focus-ring [&_svg]:size-4',
              active
                ? 'border-brand bg-surface-2 text-text'
                : 'border-transparent text-text-muted hover:bg-surface-2 hover:text-text',
            ),
            'aria-current': active ? 'page' : undefined,
            onClick: onNavigate,
            children: (
              <>
                {item.icon}
                <span className="caps">{item.label}</span>
              </>
            ),
          };
          return (
            <li key={item.href}>
              {renderLink ? renderLink(item, props) : <a href={item.href} {...props} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sidebar + top bar layout for /admin and /app. Presentational: no data fetching. */
export function AppShell({
  brand,
  title,
  nav,
  activeHref,
  labels,
  actions,
  renderLink,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r bg-surface p-4 lg:flex">
        <div className="px-3">{brand}</div>
        <NavList
          nav={nav}
          activeHref={activeHref}
          label={labels.navigation}
          renderLink={renderLink}
          onNavigate={closeMenu}
        />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" closeLabel={labels.closeMenu} className="w-72 gap-6 p-4">
          <SheetHeader className="p-0 px-3">
            <SheetTitle asChild>
              <div>{brand}</div>
            </SheetTitle>
            <SheetDescription className="sr-only">{labels.navigation}</SheetDescription>
          </SheetHeader>
          <NavList
            nav={nav}
            activeHref={activeHref}
            label={labels.navigation}
            renderLink={renderLink}
            onNavigate={closeMenu}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label={labels.openMenu}
            onClick={() => {
              setMenuOpen(true);
            }}
          >
            <MenuIcon />
          </Button>
          <p className="text-sm font-semibold text-text-muted caps">{title}</p>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
