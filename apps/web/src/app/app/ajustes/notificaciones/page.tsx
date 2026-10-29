import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { getNotificationPreferences } from '@/features/notifications/api';
import { PreferencesForm } from '@/features/notifications/components/preferences-form';
import { LoadError } from '@/features/shell/load-error';

const p = messages.notifications.preferences;

export const metadata: Metadata = { title: p.title };

export default async function NotificationSettingsPage() {
  const result = await getNotificationPreferences();
  if (!result.ok) return <LoadError code={result.code} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={p.title} description={p.description} />
      <PreferencesForm initial={result.data} />
    </div>
  );
}
