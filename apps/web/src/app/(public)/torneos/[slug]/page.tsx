import { format } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from '@league/ui';
import { UsersIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { loginPath } from '@/features/auth/access';
import { getSessionUser } from '@/features/auth/session';
import { LoadError } from '@/features/shell/load-error';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { getPublicTournament } from '@/features/tournaments/api';
import { RulebookView } from '@/features/tournaments/components/rulebook-view';
import {
  TournamentStatusBadge,
  TournamentTypeBadge,
} from '@/features/tournaments/components/status-badges';
import { Section, TournamentFacts } from '@/features/tournaments/components/tournament-facts';
import { formatDay } from '@/features/tournaments/format';
import { renderRouterLink } from '@/lib/ui/router-link';

const t = messages.tournaments;
const d = t.public.detail;
const loadTournament = cache(getPublicTournament);

export async function generateMetadata({
  params,
}: PageProps<'/torneos/[slug]'>): Promise<Metadata> {
  const result = await loadTournament((await params).slug);
  if (!result.ok) return { title: messages.errors.tournament_not_found, robots: { index: false } };
  const tournament = result.data;
  return pageMetadata({
    title: tournament.name,
    description:
      tournament.description ??
      format(t.shareDescription, {
        type: t.options.types[tournament.type],
        brand: brand.name,
        status: t.options.statuses[tournament.status],
      }),
    path: `/torneos/${tournament.slug}`,
    image: tournament.coverUrl,
  });
}

export default async function PublicTournamentPage({ params }: PageProps<'/torneos/[slug]'>) {
  const { slug } = await params;
  const [result, viewer] = await Promise.all([loadTournament(slug), getSessionUser()]);
  if (!result.ok) {
    if (result.code === 'tournament_not_found' || result.code === 'validation_failed') notFound();
    return <LoadError code={result.code} />;
  }
  const tournament = result.data;
  const registerPath = `/app/torneos/${tournament.slug}`;
  const canRegister = tournament.status === 'registration_open';

  return (
    <PageContainer>
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.breadcrumbs.home, href: '/' },
          { label: messages.publicNav.tournaments, href: '/torneos' },
          { label: tournament.name },
        ]}
        renderLink={renderRouterLink}
      />
      {tournament.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Storage image of any size.
        <img
          src={tournament.coverUrl}
          alt=""
          className="aspect-video max-h-96 w-full rounded-lg object-cover"
        />
      )}
      <div className="flex flex-col gap-3">
        <span className="flex flex-wrap gap-2">
          <TournamentTypeBadge type={tournament.type} />
          <TournamentStatusBadge status={tournament.status} />
        </span>
        <PageHeader
          title={tournament.name}
          description={
            tournament.registrationClosesAt && canRegister
              ? format(t.public.registrationUntil, {
                  date: formatDay(tournament.registrationClosesAt, tournament.timezone),
                })
              : tournament.startsAt
                ? format(t.public.startsAt, {
                    date: formatDay(tournament.startsAt, tournament.timezone),
                  })
                : undefined
          }
          actions={
            canRegister ? (
              <div className="flex flex-col items-start gap-1">
                <Button asChild size="lg">
                  <Link href={viewer ? registerPath : loginPath(registerPath)}>
                    {t.public.register}
                  </Link>
                </Button>
                {!viewer && (
                  <span className="text-xs text-text-muted">{t.public.registerHint}</span>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      <TournamentFacts tournament={tournament} />

      <Section id="participantes" title={d.participants}>
        {tournament.participants.length === 0 ? (
          <EmptyState icon={<UsersIcon />} title={d.noParticipants} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournament.participants.map((p) => {
              const card = (
                <Card className="h-full transition-colors hover:border-brand">
                  <CardContent className="flex items-center gap-3">
                    <Avatar size="lg" className="rounded-md">
                      {p.logoUrl && <AvatarImage src={p.logoUrl} alt="" className="rounded-md" />}
                      <AvatarFallback className="rounded-md">
                        {p.displayTag ?? p.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-display text-lg">{p.displayName}</span>
                      {p.displayTag && (
                        <span className="text-xs text-text-muted">{p.displayTag}</span>
                      )}
                    </span>
                  </CardContent>
                </Card>
              );
              return (
                <li key={`${p.displayName}-${p.displayTag ?? ''}`}>
                  {p.teamSlug ? (
                    <Link href={`/equipos/${p.teamSlug}`} className="focus-ring block rounded-lg">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="reglamento" title={d.rulebook}>
        {tournament.rulebook ? (
          <>
            <p className="text-sm text-text-muted">
              {format(d.rulebookVersion, {
                version: tournament.rulebook.version,
                date: formatDay(tournament.rulebook.publishedAt, tournament.timezone),
              })}
            </p>
            <Card>
              <CardContent>
                <RulebookView content={tournament.rulebook.content} />
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-text-muted">{d.noRulebook}</p>
        )}
      </Section>
    </PageContainer>
  );
}
