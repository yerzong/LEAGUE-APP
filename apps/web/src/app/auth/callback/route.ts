import { type NextRequest, NextResponse } from 'next/server';

import { publicEnv } from '@/config/public-env';
import { safeNextPath } from '@/features/auth/access';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Landing point for OAuth, magic links and email confirmation (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, publicEnv.NEXT_PUBLIC_SITE_URL));
  }

  return NextResponse.redirect(new URL('/login?error=callback', publicEnv.NEXT_PUBLIC_SITE_URL));
}
