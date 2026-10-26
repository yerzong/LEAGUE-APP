import { messages } from '@/config/i18n';

const t = messages.publicNav;

export interface SiteNavItem {
  href: string;
  label: string;
  /** Planned section: listed so the structure is ready, never linked. */
  soon?: boolean;
}

export const siteNav: readonly SiteNavItem[] = [
  { href: '/', label: t.home },
  { href: '/torneos', label: t.tournaments },
  { href: '/equipos', label: t.teams },
  { href: '/jugadores', label: t.players },
  { href: '/noticias', label: t.news, soon: true },
  { href: '/en-vivo', label: t.live, soon: true },
];

/** Section of the public nav the path belongs to (`/equipos/aurora` → `/equipos`). */
export function activeSection(pathname: string): string | undefined {
  if (pathname === '/') return '/';
  return siteNav.find(
    (item) =>
      item.href !== '/' &&
      !item.soon &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )?.href;
}

export type AccountLink = 'portal' | 'profile' | 'teams' | 'admin';

/** Account menu groups: portal links for everyone, the console for staff only. */
export function accountMenuGroups(isStaff: boolean): { href: string; key: AccountLink }[][] {
  const portal: { href: string; key: AccountLink }[] = [
    { href: '/app', key: 'portal' },
    { href: '/app/perfil', key: 'profile' },
    { href: '/app/equipos', key: 'teams' },
  ];
  return isStaff ? [portal, [{ href: '/admin', key: 'admin' }]] : [portal];
}

/** Login link that brings the visitor back to the page they were on. */
export function loginHref(pathname: string): string {
  const neutral = pathname === '/' || pathname === '/login' || pathname === '/register';
  return neutral ? '/login' : `/login?${new URLSearchParams({ next: pathname }).toString()}`;
}
