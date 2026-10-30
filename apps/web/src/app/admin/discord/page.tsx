import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { getDiscordConfig } from '@/features/discord/api';
import { DiscordConfigForm } from '@/features/discord/components/discord-config-form';
import { LoadError } from '@/features/shell/load-error';

const d = messages.discord;

export const metadata: Metadata = { title: d.title };

export default async function AdminDiscordPage() {
  const config = await getDiscordConfig();
  if (!config.ok) return <LoadError code={config.code} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={d.title} description={d.description} />
      <DiscordConfigForm config={config.data} />
    </div>
  );
}
