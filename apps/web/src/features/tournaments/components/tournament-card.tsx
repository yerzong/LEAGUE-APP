import type { PublicTournamentListItem } from '@league/contracts';
import { format } from '@league/i18n';
import { Card, CardContent } from '@league/ui';
import { CalendarIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { messages } from '@/config/i18n';

import { formatDay } from '../format';
import { TournamentStatusBadge, TournamentTypeBadge } from './status-badges';

const t = messages.tournaments;

type CardTournament = Pick<
  PublicTournamentListItem,
  | 'name'
  | 'type'
  | 'status'
  | 'coverUrl'
  | 'teamSize'
  | 'map'
  | 'capacity'
  | 'approvedCount'
  | 'entrantKind'
  | 'startsAt'
  | 'registrationClosesAt'
>;

/** Public and portal card: name, type, status, game mode, slots and dates. */
export function TournamentCard({
  tournament,
  href,
  timeZone,
  footer,
}: {
  tournament: CardTournament;
  href: string;
  timeZone: string;
  /** Extra content under the card body (portal eligibility). */
  footer?: ReactNode;
}) {
  const p = t.public;
  const slots =
    tournament.capacity === null
      ? format(p.slotsUnlimited, { approved: tournament.approvedCount })
      : format(tournament.entrantKind === 'solo' ? p.slotsSolo : p.slots, {
          approved: tournament.approvedCount,
          capacity: tournament.capacity,
        });
  return (
    <Card className="h-full overflow-hidden transition-colors hover:border-brand">
      <Link href={href} className="focus-ring flex flex-col">
        {tournament.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Storage image of any size.
          <img src={tournament.coverUrl} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div aria-hidden className="aspect-video w-full bg-surface-2 hero-grid" />
        )}
        <CardContent className="flex flex-col gap-3 pt-4">
          <span className="flex flex-wrap gap-2">
            <TournamentTypeBadge type={tournament.type} />
            <TournamentStatusBadge status={tournament.status} />
          </span>
          <span className="font-display text-xl font-bold text-text">{tournament.name}</span>
          <span className="text-sm text-text-muted">
            {format(p.gameMode, {
              size: tournament.teamSize,
              map: t.options.maps[tournament.map],
            })}
          </span>
          <span className="flex flex-col gap-1 text-sm text-text-muted">
            <span className="flex items-center gap-2">
              <UsersIcon aria-hidden className="size-4" />
              {slots}
            </span>
            {tournament.startsAt && (
              <span className="flex items-center gap-2">
                <CalendarIcon aria-hidden className="size-4" />
                {format(p.startsAt, { date: formatDay(tournament.startsAt, timeZone) })}
              </span>
            )}
          </span>
        </CardContent>
      </Link>
      {footer && <CardContent className="border-t border-border pt-4">{footer}</CardContent>}
    </Card>
  );
}
