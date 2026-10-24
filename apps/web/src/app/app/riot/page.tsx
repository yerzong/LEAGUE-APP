import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { getDataDragonVersion, getMyRiotAccount } from '@/features/riot/api';
import { RiotLink } from '@/features/riot/components/riot-link';
import { LoadError } from '@/features/shell/load-error';

export const metadata: Metadata = { title: messages.riot.title };

export default async function RiotPage() {
  const [riot, version] = await Promise.all([getMyRiotAccount(), getDataDragonVersion()]);
  if (!riot.ok) return <LoadError code={riot.code} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={messages.riot.title} description={messages.riot.description} />
      {/* Remount when the server state changes (linked or unlinked). */}
      <RiotLink
        key={riot.data.account?.verifiedAt ?? 'unlinked'}
        initial={riot.data}
        iconVersion={version}
      />
    </div>
  );
}
