import { format } from '@league/i18n';
import Image from 'next/image';

import { brand } from '@/config/brand';
import { getServerEnv } from '@/config/env';
import { messages } from '@/config/i18n';
import { getApiHealth } from '@/features/health/api/get-api-health';
import { ApiStatus } from '@/features/health/components/api-status';

// Health is read on every request, never at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getApiHealth(getServerEnv().API_URL);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <Image
        src={brand.logo.src}
        alt={brand.name}
        width={brand.logo.width}
        height={brand.logo.height}
        priority
      />
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide text-brand">
        {format(messages.home.title, { brand: brand.name })}
      </h1>
      <p className="max-w-xl text-lg text-text-muted">{messages.home.subtitle}</p>
      <ApiStatus
        status={health}
        label={messages.health.label}
        statusLabels={messages.health.status}
      />
    </section>
  );
}
