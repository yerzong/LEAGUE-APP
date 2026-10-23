import 'server-only';

import type { PlatformRole } from '@league/db';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { loginPath } from './access';

export interface SessionUser {
  id: string;
  email: string | null;
  platformRole: PlatformRole;
}

/** Verified session user (JWT checked by Supabase), or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  // RLS lets a user read only their own profile row.
  const { data: profile } = await supabase
    .from('users')
    .select('platform_role')
    .eq('id', claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    platformRole: profile?.platform_role ?? 'user',
  };
}

export async function requireUser(currentPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPath(currentPath));
  return user;
}

export async function requireSuperAdmin(currentPath: string): Promise<SessionUser> {
  const user = await requireUser(currentPath);
  if (user.platformRole !== 'super_admin') redirect('/app');
  return user;
}
