import { Card, CardContent, PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { getMyFreeAgent } from '@/features/teams/api';
import { FreeAgentForm } from '@/features/teams/components/free-agent-form';

export const metadata: Metadata = { title: messages.freeAgent.title };

export default async function FreeAgentPage() {
  const listing = await getMyFreeAgent();
  if (!listing.ok) return <LoadError code={listing.code} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={messages.freeAgent.title} description={messages.freeAgent.description} />
      <Card>
        <CardContent>
          <FreeAgentForm initial={listing.data} />
        </CardContent>
      </Card>
    </div>
  );
}
