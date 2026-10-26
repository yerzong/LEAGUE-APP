'use client';

import { Button, PublicHeader, UserMenu } from '@league/ui';
import { HouseIcon, LayoutDashboardIcon, ShieldIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useTransition } from 'react';

import { messages } from '@/config/i18n';
import { signOut } from '@/features/auth/actions';
import { renderRouterLink } from '@/lib/ui/router-link';

import { accountMenuGroups, activeSection, type AccountLink, loginHref, siteNav } from '../nav';

const t = messages.publicNav;

const accountIcons: Record<AccountLink, ReactNode> = {
  portal: <HouseIcon />,
  profile: <UserIcon />,
  teams: <ShieldIcon />,
  admin: <LayoutDashboardIcon />,
};

export interface HeaderAccount {
  name: string;
  detail?: string | undefined;
  initials: string;
  avatarUrl: string | null;
  isStaff: boolean;
}

export function SiteHeaderBar({
  brand,
  account,
}: {
  brand: ReactNode;
  account: HeaderAccount | null;
}) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const login = loginHref(pathname);

  return (
    <PublicHeader
      brand={brand}
      nav={[...siteNav]}
      activeHref={activeSection(pathname)}
      labels={t}
      renderLink={renderRouterLink}
      actions={
        account ? (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/app">{t.account.portal}</Link>
            </Button>
            <UserMenu
              name={account.name}
              detail={account.detail}
              initials={account.initials}
              avatarUrl={account.avatarUrl}
              groups={accountMenuGroups(account.isStaff).map((group) =>
                group.map((link) => ({
                  href: link.href,
                  label: t.account[link.key],
                  icon: accountIcons[link.key],
                })),
              )}
              onSignOut={() => {
                startTransition(() => signOut());
              }}
              labels={{ trigger: t.account.trigger, signOut: t.account.signOut }}
              renderLink={renderRouterLink}
            />
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={login}>{t.login}</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/register">{t.register}</Link>
            </Button>
          </>
        )
      }
      menuActions={
        account ? undefined : (
          <>
            <Button asChild>
              <Link href="/register">{t.register}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={login}>{t.login}</Link>
            </Button>
          </>
        )
      }
    />
  );
}
