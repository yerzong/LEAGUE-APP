import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';
import { getMyProfile } from '@/features/profile/api';
import { OnboardingCard } from '@/features/profile/components/onboarding-card';
import { getMyInvitations, getMyTeams } from '@/features/teams/api';
import { InvitationList } from '@/features/teams/components/invitation-list';
import { TeamCard } from '@/features/teams/components/team-card';

export const metadata: Metadata = { title: messages.portal.title };

export default async function PortalHomePage() {
  const [profile, invitations, teams] = await Promise.all([
    getMyProfile(),
    getMyInvitations(),
    getMyTeams(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={messages.portal.title} description={messages.portal.subtitle} />
      {profile.ok && <OnboardingCard missing={profile.data.missing} />}
      {invitations.ok && <InvitationList invitations={invitations.data} />}
      {teams.ok && teams.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="caps text-sm text-text-muted">{messages.teams.title}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {teams.data.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                role={team.myRole}
                href={`/app/equipos/${team.slug}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
