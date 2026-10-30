import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from '@league/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { messages } from '@/config/i18n';
import { loginPath } from '@/features/auth/access';
import { getSessionUser } from '@/features/auth/session';
import { LoadError } from '@/features/shell/load-error';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { getTeamStats } from '@/features/stats/api';
import { FollowButton } from '@/features/stats/components/follow-button';
import { TeamStatsView } from '@/features/stats/components/team-stats';
import { getPublicTeam } from '@/features/teams/api';
import { JoinRequestButton } from '@/features/teams/components/join-request-button';
import { formatDate, initials } from '@/lib/ui/dates';
import { renderRouterLink } from '@/lib/ui/router-link';

const t = messages.publicPages.team;
const loadTeam = cache(getPublicTeam);

export async function generateMetadata({
  params,
}: PageProps<'/equipos/[slug]'>): Promise<Metadata> {
  const team = await loadTeam((await params).slug);
  if (!team.ok) return { title: t.notFound, robots: { index: false } };
  const { name, tag, slug, members, region, logoUrl, description } = team.data;
  return pageMetadata({
    title: `${name} [${tag}]`,
    description:
      description ??
      format(t.shareDescription, {
        region: messages.options.gameRegions[region],
        count: members.length,
      }),
    path: `/equipos/${slug}`,
    image: logoUrl,
  });
}

export default async function PublicTeamPage({ params }: PageProps<'/equipos/[slug]'>) {
  const { slug } = await params;
  const [team, viewer, stats] = await Promise.all([
    loadTeam(slug),
    getSessionUser(),
    getTeamStats(slug),
  ]);
  if (!team.ok) {
    if (team.code === 'team_not_found' || team.code === 'validation_failed') notFound();
    return <LoadError code={team.code} />;
  }
  const data = team.data;
  const active = data.status === 'active';

  return (
    <PageContainer>
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.breadcrumbs.home, href: '/' },
          { label: messages.publicNav.teams, href: '/equipos' },
          { label: data.name },
        ]}
        renderLink={renderRouterLink}
      />
      <div className="flex flex-wrap items-center gap-6">
        <Avatar size="lg" className="size-24 rounded-md">
          {data.logoUrl && <AvatarImage src={data.logoUrl} alt="" className="rounded-md" />}
          <AvatarFallback className="rounded-md text-xl">{data.tag}</AvatarFallback>
        </Avatar>
        <PageHeader
          className="flex-1"
          eyebrow={data.tag}
          title={data.name}
          description={data.description ?? undefined}
          actions={
            active ? (
              <div className="flex flex-wrap items-center gap-3">
                {stats.ok && (
                  <FollowButton
                    type="team"
                    targetKey={data.slug}
                    name={data.name}
                    initial={stats.data.follow}
                    loginHref={viewer ? undefined : loginPath(`/equipos/${data.slug}`)}
                  />
                )}
                {viewer ? (
                  <JoinRequestButton teamId={data.id} teamName={data.name} />
                ) : (
                  <Button asChild variant="secondary">
                    <Link href={loginPath(`/equipos/${data.slug}`)}>
                      {messages.joinRequest.loginToRequest}
                    </Link>
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="blue">
          {format(t.region, { region: messages.options.gameRegions[data.region] })}
        </Badge>
        <Badge variant="blue">{format(t.since, { date: formatDate(data.createdAt) })}</Badge>
        {!active && <Badge variant="danger">{t.disbanded}</Badge>}
      </div>

      {stats.ok && <TeamStatsView stats={stats.data} teamSlug={data.slug} />}

      <section className="flex flex-col gap-4">
        <h2 className="caps text-sm text-text-muted">{t.roster}</h2>
        {data.members.length === 0 ? (
          <EmptyState title={t.emptyRoster} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.members.map((member) => {
              const name = member.displayName ?? member.username ?? '';
              return (
                <li key={member.username ?? name}>
                  <Card>
                    <CardContent className="flex items-center gap-3">
                      <Avatar size="lg">
                        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1">
                        {member.username ? (
                          <Link
                            className="font-display text-lg"
                            href={`/jugadores/${member.username}?equipo=${data.slug}`}
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="font-display text-lg">{name}</span>
                        )}
                        <span className="flex flex-wrap gap-1">
                          <Badge variant={member.teamRole === 'captain' ? 'league' : 'blue'}>
                            {messages.options.teamRoles[member.teamRole]}
                          </Badge>
                          {member.primaryRole && (
                            <Badge variant="blue">
                              {messages.options.playerRoles[member.primaryRole]}
                            </Badge>
                          )}
                        </span>
                        {member.riotId && (
                          <span className="text-xs text-text-muted">{member.riotId}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
