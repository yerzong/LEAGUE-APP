import { HouseIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { requireUser } from '@/features/auth/session';
import { BrandMark } from '@/features/shell/brand-mark';
import { ZoneShell } from '@/features/shell/zone-shell';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireUser('/app');

  return (
    <ZoneShell
      brand={<BrandMark href="/app" />}
      title={messages.zones.portal}
      nav={[{ href: '/app', label: messages.shell.nav.portalHome, icon: <HouseIcon /> }]}
      actions={<SignOutButton />}
    >
      {children}
    </ZoneShell>
  );
}
