import {
  GamepadIcon,
  HeartIcon,
  HouseIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  SwordsIcon,
  TrophyIcon,
  UserIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { BackToSiteLink } from '@/features/shell/back-to-site-link';
import { requireUser } from '@/features/auth/session';
import { getInbox } from '@/features/notifications/api';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { BrandMark } from '@/features/shell/brand-mark';
import { ZoneShell } from '@/features/shell/zone-shell';

const nav = messages.shell.nav;

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireUser('/app');
  const inbox = await getInbox({ limit: 8 });

  return (
    <ZoneShell
      brand={<BrandMark href="/app" />}
      title={messages.zones.portal}
      nav={[
        { href: '/app', label: nav.portalHome, icon: <HouseIcon /> },
        { href: '/app/perfil', label: nav.profile, icon: <UserIcon /> },
        { href: '/app/riot', label: nav.riot, icon: <GamepadIcon /> },
        { href: '/app/equipos', label: nav.teams, icon: <ShieldIcon /> },
        { href: '/app/torneos', label: nav.portalTournaments, icon: <TrophyIcon /> },
        { href: '/app/partidas', label: nav.portalMatches, icon: <SwordsIcon /> },
        { href: '/app/agente-libre', label: nav.freeAgent, icon: <SearchIcon /> },
        { href: '/app/siguiendo', label: nav.following, icon: <HeartIcon /> },
        { href: '/app/ajustes/notificaciones', label: nav.settings, icon: <SettingsIcon /> },
      ]}
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
