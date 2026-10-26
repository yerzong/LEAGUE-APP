import 'server-only';

import { getSessionUser } from '@/features/auth/session';
import { BrandMark } from '@/features/shell/brand-mark';
import { publicStorageUrl } from '@/lib/storage/public-url';
import { initials } from '@/lib/ui/dates';

import { SiteHeaderBar } from './site-header-bar';

/** Reads the session on the server, so the bar never flashes "guest" for a signed-in user. */
export async function SiteHeader() {
  const user = await getSessionUser();
  const name = user?.displayName ?? user?.username ?? user?.email ?? '';

  return (
    <SiteHeaderBar
      brand={<BrandMark href="/" />}
      account={
        user
          ? {
              name,
              detail: user.username ? `@${user.username}` : (user.email ?? undefined),
              initials: initials(name),
              avatarUrl: publicStorageUrl('avatars', user.avatarPath),
              isStaff: user.platformRole === 'super_admin',
            }
          : null
      }
    />
  );
}
