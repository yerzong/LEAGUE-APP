import { format } from '@league/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { publicEnv } from '@/config/public-env';
import { AuthCard, Divider } from '@/features/auth/components/auth-card';
import { OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { SignUpForm } from '@/features/auth/components/sign-up-form';

const t = messages.auth;

export const metadata: Metadata = { title: t.register.title };

export default function RegisterPage() {
  return (
    <AuthCard
      title={t.register.title}
      subtitle={format(t.register.subtitle, { brand: brand.name })}
      footer={
        <>
          {t.register.hasAccount}{' '}
          <Link href="/login" className="text-brand underline">
            {t.register.login}
          </Link>
        </>
      }
    >
      <OAuthButtons next="/app" googleEnabled={publicEnv.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED} />
      <Divider label={t.or} />
      <SignUpForm />
    </AuthCard>
  );
}
