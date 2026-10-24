import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Card,
  CardContent,
  PageHeader,
} from '@league/ui';
import { BadgeCheckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { messages } from '@/config/i18n';
import { countryName } from '@/features/profile/options';
import { LoadError } from '@/features/shell/load-error';
import { getPublicPlayer } from '@/features/teams/api';
import { TeamCard } from '@/features/teams/components/team-card';
import { initials } from '@/lib/ui/dates';

const t = messages.publicPages.player;
const loadPlayer = cache(getPublicPlayer);

export async function generateMetadata({
  params,
}: PageProps<'/jugadores/[username]'>): Promise<Metadata> {
  const player = await loadPlayer((await params).username);
  return { title: player.ok ? (player.data.displayName ?? player.data.username) : t.notFound };
}

export default async function PublicPlayerPage({ params }: PageProps<'/jugadores/[username]'>) {
  const { username } = await params;
  const player = await loadPlayer(username);
  if (!player.ok) {
    if (player.code === 'player_not_found' || player.code === 'validation_failed') notFound();
    return <LoadError code={player.code} />;
  }
  const p = player.data;
  const name = p.displayName ?? p.username;
  const roles = [p.primaryRole, p.secondaryRole].filter((role) => role !== null);

  return (
    <div className="flex flex-col gap-8 py-10">
      <div className="flex flex-wrap items-center gap-6">
        <Avatar size="lg" className="size-24">
          {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}
          <AvatarFallback className="text-xl">{initials(name)}</AvatarFallback>
        </Avatar>
        <PageHeader
          className="flex-1"
          eyebrow={`@${p.username}`}
          title={name}
          description={p.bio ?? undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {p.riotAccount ? (
          <Badge variant="success">
            <BadgeCheckIcon />
            {t.riotVerified}: {p.riotAccount.gameName}#{p.riotAccount.tagLine} ·{' '}
            {messages.options.gameRegions[p.riotAccount.region]}
          </Badge>
        ) : (
          <Badge variant="blue">{t.noRiot}</Badge>
        )}
        {roles.map((role) => (
          <Badge key={role} variant="blue">
            {messages.options.playerRoles[role]}
          </Badge>
        ))}
        {p.gameRegion && <Badge variant="blue">{messages.options.gameRegions[p.gameRegion]}</Badge>}
        {p.countryCode && <Badge variant="blue">{countryName(p.countryCode)}</Badge>}
        {p.isAdult && <Badge variant="blue">{t.adult}</Badge>}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="caps text-sm text-text-muted">{t.teams}</h2>
        {p.teams.length === 0 ? (
          <p className="text-sm text-text-muted">{t.noTeams}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {p.teams.map((team) => (
              <TeamCard
                key={team.slug}
                team={team}
                role={team.teamRole}
                href={`/equipos/${team.slug}`}
              />
            ))}
          </div>
        )}
      </section>

      {p.socialLinks.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="caps text-sm text-text-muted">{t.social}</h2>
          <Card>
            <CardContent className="flex flex-wrap gap-3">
              {p.socialLinks.map((link) => (
                <Link
                  key={link.url}
                  href={link.url}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="focus-ring underline"
                >
                  {messages.options.socialPlatforms[link.platform]}
                  {link.handle && ` · ${link.handle}`}
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
