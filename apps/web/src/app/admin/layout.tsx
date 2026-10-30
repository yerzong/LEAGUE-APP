import {
  AwardIcon,
  BellIcon,
  LayersIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SwatchBookIcon,
  TrophyIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { isKitchenSinkEnabled } from '@/config/kitchen-sink';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { BackToSiteLink } from '@/features/shell/back-to-site-link';
import { requireSuperAdmin } from '@/features/auth/session';
import { getInbox } from '@/features/notifications/api';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { BrandMark } from '@/features/shell/brand-mark';
import { ZoneShell } from '@/features/shell/zone-shell';

const { nav } = messages.shell;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireSuperAdmin('/admin');
  const inbox = await getInbox({ limit: 8 });

  const items = [
    { href: '/admin', label: nav.adminHome, icon: <LayoutDashboardIcon /> },
    { href: '/admin/torneos', label: nav.adminTournaments, icon: <TrophyIcon /> },
    { href: '/admin/plantillas', label: nav.adminTemplates, icon: <LayersIcon /> },
    { href: '/admin/notificaciones', label: nav.adminNotifications, icon: <BellIcon /> },
    { href: '/admin/discord', label: nav.adminDiscord, icon: <MessageSquareIcon /> },
    { href: '/admin/logros', label: nav.adminAchievements, icon: <AwardIcon /> },
    ...(isKitchenSinkEnabled()
      ? [{ href: '/admin/kitchen-sink', label: nav.kitchenSink, icon: <SwatchBookIcon /> }]
      : []),
  ];

  return (
    <ZoneShell
      brand={<BrandMark href="/admin" />}
      title={messages.zones.admin}
      nav={items}
      actions={
        <>
          <NotificationBell userId={user.id} initial={inbox.ok ? inbox.data : null} />
          <BackToSiteLink />
          <SignOutButton />
        </>
      }
    >
      {children}
    </ZoneShell>
  );
}
