import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { getServerEnv } from '@/config/env';
import { getApiHealth } from '@/features/health/api/get-api-health';
import { ApiStatus } from '@/features/health/components/api-status';

export const metadata: Metadata = { title: messages.admin.title };

export default async function AdminHomePage() {
  const health = await getApiHealth(getServerEnv().API_URL);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={messages.admin.title} description={messages.admin.subtitle} />
      <ApiStatus
        status={health}
        label={messages.health.label}
        statusLabels={messages.health.status}
      />
    </div>
  );
}
