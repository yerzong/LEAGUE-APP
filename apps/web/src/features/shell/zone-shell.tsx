'use client';

import { AppShell, type AppShellNavItem } from '@league/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';

export interface ZoneShellProps {
  brand: ReactNode;
  title: string;
  nav: AppShellNavItem[];
  actions?: ReactNode;
  children: ReactNode;
}

/** AppShell wired to the Next.js router (client links, active section). */
export function ZoneShell({ brand, title, nav, actions, children }: ZoneShellProps) {
  const pathname = usePathname();
  // Longest matching href wins, so /admin/kitchen-sink does not also light up /admin.
  const activeHref = nav
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <AppShell
      brand={brand}
      title={title}
      nav={nav}
      activeHref={activeHref}
      labels={messages.shell}
      actions={actions}
      renderLink={(item, { children: content, ...props }) => (
        <Link href={item.href} {...props}>
          {content}
        </Link>
      )}
    >
      {children}
    </AppShell>
  );
}
