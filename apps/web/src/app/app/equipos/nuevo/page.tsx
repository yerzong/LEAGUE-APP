import { Card, CardContent, PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { TeamForm } from '@/features/teams/components/team-form';

export const metadata: Metadata = { title: messages.teams.createTitle };

export default function NewTeamPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={messages.teams.createTitle}
        description={messages.teams.createDescription}
      />
      <Card>
        <CardContent>
          <TeamForm />
        </CardContent>
      </Card>
    </div>
  );
}
