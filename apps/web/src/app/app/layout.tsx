import { GamepadIcon, HouseIcon, SearchIcon, ShieldIcon, UserIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { requireUser } from '@/features/auth/session';
import { BrandMark } from '@/features/shell/brand-mark';
import { ZoneShell } from '@/features/shell/zone-shell';

const nav = messages.shell.nav;

export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireUser('/app');

  return (
    <ZoneShell
      brand={<BrandMark href="/app" />}
      title={messages.zones.portal}
      nav={[
        { href: '/app', label: nav.portalHome, icon: <HouseIcon /> },
        { href: '/app/perfil', label: nav.profile, icon: <UserIcon /> },
        { href: '/app/riot', label: nav.riot, icon: <GamepadIcon /> },
        { href: '/app/equipos', label: nav.teams, icon: <ShieldIcon /> },
        { href: '/app/agente-libre', label: nav.freeAgent, icon: <SearchIcon /> },
      ]}
      actions={<SignOutButton />}
    >
      {children}
    </ZoneShell>
  );
}
