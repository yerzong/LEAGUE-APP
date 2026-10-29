import type { Champion } from '@league/contracts';
import { Avatar, AvatarFallback, AvatarImage, cn } from '@league/ui';

/** Square champion icon from Data Dragon, with initials when there is none. */
export function ChampionIcon({
  champion,
  size = 'default',
  className,
}: {
  champion: Champion;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  return (
    <Avatar size={size} className={cn('rounded-sm', className)} title={champion.name}>
      {champion.iconUrl && (
        <AvatarImage src={champion.iconUrl} alt={champion.name} className="rounded-sm" />
      )}
      <AvatarFallback className="rounded-sm text-xs">
        {champion.name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
