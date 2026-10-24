import type { Database } from '@league/db';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { publicEnv } from '@/config/public-env';
import { decideZoneAccess, loginPath, protectedZoneOf } from '@/features/auth/access';

/**
 * Refreshes the Supabase session cookies on every request and gates /app and
 * /admin. Layouts check again on the server (defense in depth).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const zone = protectedZoneOf(request.nextUrl.pathname);
  if (!zone) return response;

  let isSuperAdmin = false;
  if (zone === 'admin' && userId) {
    const { data: profile } = await supabase
      .from('users')
      .select('platform_role')
      .eq('id', userId)
      .maybeSingle();
    isSuperAdmin = profile?.platform_role === 'super_admin';
  }

  const decision = decideZoneAccess(zone, { authenticated: Boolean(userId), isSuperAdmin });
  if (decision === 'allow') return response;

  const { pathname, search } = request.nextUrl;
  const target = decision === 'login' ? loginPath(`${pathname}${search}`) : '/app';
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
