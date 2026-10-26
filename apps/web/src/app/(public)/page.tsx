import { format, plural } from '@league/i18n';
import { Button, Card, CardContent, EmptyState, Hero, SectionHeading } from '@league/ui';
import { CalendarClockIcon, ShieldIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { getSessionUser } from '@/features/auth/session';
import { listPublicTeams } from '@/features/site/api';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { TeamCard } from '@/features/teams/components/team-card';

const t = messages.home;

export const metadata: Metadata = {
  ...pageMetadata({
    title: t.meta.title,
    description: messages.meta.description,
    path: '/',
  }),
  // The home shows the brand alone, without the "· brand" suffix.
  title: { absolute: `${brand.name} · ${t.meta.title}` },
};

export default async function HomePage() {
  const [user, teams] = await Promise.all([
    getSessionUser(),
    listPublicTeams({ q: '', page: 1, pageSize: 6 }),
  ]);
  const featured = teams.ok ? teams.data.items : [];

  return (
    <>
      <Hero
        eyebrow={t.hero.eyebrow}
        title={t.hero.title}
        description={format(t.hero.description, { brand: brand.name })}
        actions={
          user ? (
            <>
              <Button asChild size="lg">
                <Link href="/app">{t.hero.portal}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/torneos">{t.hero.explore}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/torneos">{t.hero.explore}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/register">{t.hero.register}</Link>
              </Button>
            </>
          )
        }
        media={
          <Image
            src={brand.logo.src}
            alt={brand.name}
            width={brand.logo.width}
            height={brand.logo.height}
            priority
            className="h-auto w-full"
          />
        }
      />

      <PageContainer className="gap-16 py-16">
        <section aria-labelledby="home-season" className="flex flex-col gap-6">
          <SectionHeading id="home-season" eyebrow={t.season.eyebrow} title={t.season.title} />
          <EmptyState
            variant="showcase"
            icon={<CalendarClockIcon />}
            title={t.season.emptyTitle}
            description={t.season.emptyDescription}
            action={
              <Button asChild variant="outline">
                <Link href="/torneos">{t.season.action}</Link>
              </Button>
            }
          />
        </section>

        <section aria-labelledby="home-teams" className="flex flex-col gap-6">
          <SectionHeading
            id="home-teams"
            eyebrow={t.teams.eyebrow}
            title={t.teams.title}
            description={t.teams.description}
            action={
              featured.length > 0 && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/equipos">{t.teams.seeAll}</Link>
                </Button>
              )
            }
          />
          {featured.length === 0 ? (
            <EmptyState
              variant="showcase"
              icon={<ShieldIcon />}
              title={t.teams.emptyTitle}
              description={t.teams.emptyDescription}
              action={
                <Button asChild variant="outline">
                  <Link href={user ? '/app/equipos/nuevo' : '/register'}>{t.teams.create}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((team) => (
                <li key={team.slug}>
                  <TeamCard
                    team={team}
                    href={`/equipos/${team.slug}`}
                    detail={plural(messages.teamsPage.members, team.memberCount)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-how" className="flex flex-col gap-6">
          <SectionHeading id="home-how" eyebrow={t.howItWorks.eyebrow} title={t.howItWorks.title} />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.howItWorks.steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-3">
                    <span
                      aria-hidden
                      className="font-display text-4xl leading-none font-extrabold text-brand-dim tabular"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="font-display text-lg font-bold text-text caps">{step.title}</h3>
                    <p className="text-sm text-text-muted">{step.description}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
          {!user && (
            <div>
              <Button asChild variant="outline">
                <Link href="/register">{t.howItWorks.action}</Link>
              </Button>
            </div>
          )}
        </section>

        <section
          aria-labelledby="home-cta"
          className="relative isolate flex flex-col items-start gap-4 overflow-hidden rounded-lg border bg-surface px-6 py-10 sm:items-center sm:px-10 sm:text-center"
        >
          <div aria-hidden className="absolute inset-0 -z-10 opacity-60 hero-grid" />
          <h2 id="home-cta" className="font-display text-3xl font-extrabold text-brand-bright caps">
            {t.finalCta.title}
          </h2>
          <p className="max-w-xl text-text-muted">{t.finalCta.description}</p>
          <Button asChild size="lg">
            <Link href={user ? '/app' : '/register'}>
              {user ? t.finalCta.portal : t.finalCta.register}
            </Link>
          </Button>
        </section>
      </PageContainer>
    </>
  );
}
