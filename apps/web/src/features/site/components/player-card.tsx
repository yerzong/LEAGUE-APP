import type { PublicPlayerListItem } from '@league/contracts';
import { Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent } from '@league/ui';
import { BadgeCheckIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { initials } from '@/lib/ui/dates';

/** Directory card: only the fields the player made public arrive here. */
export function PlayerCard({ player }: { player: PublicPlayerListItem }) {
  const name = player.displayName ?? player.username;
  return (
    <Link href={`/jugadores/${player.username}`} className="focus-ring rounded-lg">
      <Card className="h-full transition-colors hover:border-brand">
        <CardContent className="flex items-center gap-3">
          <Avatar size="lg">
            {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" />}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-display text-lg">{name}</span>
            <span className="truncate text-xs text-text-muted">@{player.username}</span>
            <span className="flex flex-wrap gap-1">
              {player.primaryRole && (
                <Badge variant="blue">{messages.options.playerRoles[player.primaryRole]}</Badge>
              )}
              {player.gameRegion && (
                <Badge variant="blue">{messages.options.gameRegions[player.gameRegion]}</Badge>
              )}
              {player.riotVerified && (
                <Badge variant="success">
                  <BadgeCheckIcon />
                  {messages.playersPage.riotVerified}
                </Badge>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
