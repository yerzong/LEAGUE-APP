import type { TeamRole, TeamSummary } from '@league/contracts';
import { Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent } from '@league/ui';
import Link from 'next/link';

import { messages } from '@/config/i18n';

type CardTeam = Pick<TeamSummary, 'name' | 'tag'> &
  Partial<Pick<TeamSummary, 'logoUrl' | 'region'>>;

export function TeamCard({ team, role, href }: { team: CardTeam; role?: TeamRole; href: string }) {
  return (
    <Link href={href} className="focus-ring rounded-lg">
      <Card className="transition-colors hover:border-brand">
        <CardContent className="flex items-center gap-3">
          <Avatar size="lg" className="rounded-md">
            {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" className="rounded-md" />}
            <AvatarFallback className="rounded-md">{team.tag}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="font-display text-lg">{team.name}</span>
            <span className="flex gap-2">
              <Badge variant="blue">{team.tag}</Badge>
              {team.region && (
                <Badge variant="blue">{messages.options.gameRegions[team.region]}</Badge>
              )}
              {role && (
                <Badge variant={role === 'captain' ? 'league' : 'blue'}>
                  {messages.options.teamRoles[role]}
                </Badge>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
