'use server';

import {
  MagicLinkSchema,
  OAuthProviderSchema,
  SignInWithPasswordSchema,
  SignUpSchema,
} from '@league/contracts';
import type { AuthError } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { messages } from '@/config/i18n';
import { publicEnv } from '@/config/public-env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { decideZoneAccess, protectedZoneOf, safeNextPath } from './access';

export type AuthFormState =
  { status: 'idle' } | { status: 'error'; message: string } | { status: 'sent'; message: string };

const errors = messages.auth.errors;

function callbackUrl(next: string): string {
  const url = new URL('/auth/callback', publicEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set('next', next);
  return url.toString();
}

// Supabase messages are never shown as-is: they are in English and may leak details.
function toMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return errors.invalidCredentials;
    case 'email_not_confirmed':
      return errors.emailNotConfirmed;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return errors.rateLimited;
    case 'weak_password':
      return errors.invalidPassword;
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return errors.invalidEmail;
    default:
      return errors.unknown;
  }
}

export async function signInWithPassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = SignInWithPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { status: 'error', message: errors.invalidCredentials };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error) return { status: 'error', message: toMessage(error) };

  // Resolve access here: a layout redirect inside an action response would leave
  // the browser on the forbidden URL.
  const next = safeNextPath(formData.get('next'));
  const zone = protectedZoneOf(new URL(next, publicEnv.NEXT_PUBLIC_SITE_URL).pathname);
  if (zone) {
    const { data: profile } = await supabase
      .from('users')
      .select('platform_role')
      .eq('id', data.user.id)
      .maybeSingle();
    const isSuperAdmin = profile?.platform_role === 'super_admin';
    if (decideZoneAccess(zone, { authenticated: true, isSuperAdmin }) === 'forbidden') {
      redirect('/app');
    }
  }

  redirect(next);
}

export async function signUp(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = SignUpSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) {
    const emailInvalid = input.error.issues.some((issue) => issue.path[0] === 'email');
    return {
      status: 'error',
      message: emailInvalid ? errors.invalidEmail : errors.invalidPassword,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    ...input.data,
    options: { emailRedirectTo: callbackUrl('/app') },
  });
  if (error) return { status: 'error', message: toMessage(error) };

  return { status: 'sent', message: messages.auth.register.sent };
}

export async function sendMagicLink(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = MagicLinkSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { status: 'error', message: errors.invalidEmail };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: input.data.email,
    options: { emailRedirectTo: callbackUrl(safeNextPath(formData.get('next'))) },
  });
  if (error) return { status: 'error', message: toMessage(error) };

  return { status: 'sent', message: messages.auth.magicLink.sent };
}

export async function signInWithOAuth(formData: FormData): Promise<void> {
  const provider = OAuthProviderSchema.parse(formData.get('provider'));
  if (provider === 'google' && !publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED) {
    redirect('/login?error=callback');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl(safeNextPath(formData.get('next'))) },
  });
  if (error) redirect('/login?error=callback');

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
