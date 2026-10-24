import { format } from '@league/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { publicEnv } from '@/config/public-env';
import { safeNextPath } from '@/features/auth/access';
import { AuthCard, Divider } from '@/features/auth/components/auth-card';
import { MagicLinkForm } from '@/features/auth/components/magic-link-form';
import { OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { PasswordSignInForm } from '@/features/auth/components/password-sign-in-form';

const t = messages.auth;

export const metadata: Metadata = { title: t.login.title };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const hasError = params.error !== undefined;

  return (
    <AuthCard
      title={t.login.title}
      subtitle={format(t.login.subtitle, { brand: brand.name })}
      footer={
        <>
          {t.login.noAccount}{' '}
          <Link href="/register" className="text-brand underline">
            {t.login.register}
          </Link>
        </>
      }
    >
      {hasError && (
        <p role="alert" className="text-sm text-danger">
          {t.errors.callback}
        </p>
      )}
      <OAuthButtons next={next} googleEnabled={publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED} />
      <Divider label={t.or} />
      <PasswordSignInForm next={next} />
      <Divider label={t.or} />
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-text">{t.magicLink.title}</h2>
        <MagicLinkForm next={next} />
      </div>
    </AuthCard>
  );
}
