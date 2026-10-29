import { RADAR_AXES, type HeadToHead } from '@league/contracts';
import { format, plural } from '@league/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Breadcrumbs,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  StatRadar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@league/ui';
import { SwordsIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { locale, messages } from '@/config/i18n';
import { LoadError } from '@/features/shell/load-error';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { getHeadToHead } from '@/features/stats/api';
import { radarAxes } from '@/features/stats/components/aggregate-view';
import { decimal, percent } from '@/features/stats/format';
import { initials } from '@/lib/ui/dates';
import { renderRouterLink } from '@/lib/ui/router-link';

const s = messages.stats;
const t = s.h2h;
const load = cache(getHeadToHead);
const nameOf = (p: HeadToHead['a']) => p.displayName ?? p.username;

export async function generateMetadata({
  params,
}: PageProps<'/jugadores/[username]/vs/[other]'>): Promise<Metadata> {
  const { username, other } = await params;
  const result = await load(username, other);
  if (!result.ok) return { title: messages.errors.player_not_found, robots: { index: false } };
  const names = { a: nameOf(result.data.a), b: nameOf(result.data.b) };
  return pageMetadata({
    title: format(t.title, names),
    description: format(t.description, names),
    path: `/jugadores/${username}/vs/${other}`,
  });
}

function PlayerSide({ player, wins }: { player: HeadToHead['a']; wins: number }) {
  return (
    <Link href={`/jugadores/${player.username}`} className="flex items-center gap-3">
      <Avatar size="lg" className="size-16">
        {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt="" />}
        <AvatarFallback>{initials(nameOf(player))}</AvatarFallback>
      </Avatar>
      <span className="flex flex-col">
        <span className="font-display text-2xl">{nameOf(player)}</span>
        <span className="text-sm text-text-muted">
          {t.wins}: <span className="tabular font-semibold text-text">{wins}</span>
        </span>
      </span>
    </Link>
  );
}

export default async function HeadToHeadPage({
  params,
}: PageProps<'/jugadores/[username]/vs/[other]'>) {
  const { username, other } = await params;
  const result = await load(username, other);
  if (!result.ok) {
    if (['player_not_found', 'validation_failed', 'same_player'].includes(result.code)) notFound();
    return <LoadError code={result.code} />;
  }
  const h = result.data;
  const names = { a: nameOf(h.a), b: nameOf(h.b) };
  const rows =
    h.statsA && h.statsB
      ? [
          { label: s.tiles.kda, a: decimal(h.statsA.kda, 2), b: decimal(h.statsB.kda, 2) },
          {
            label: s.tiles.csPerMin,
            a: decimal(h.statsA.avgCsPerMin),
            b: decimal(h.statsB.avgCsPerMin),
          },
          {
            label: s.tiles.damagePerMin,
            a: decimal(h.statsA.avgDamagePerMin, 0),
            b: decimal(h.statsB.avgDamagePerMin, 0),
          },
          {
            label: s.tiles.visionPerMin,
            a: decimal(h.statsA.avgVisionPerMin, 2),
            b: decimal(h.statsB.avgVisionPerMin, 2),
          },
          {
            label: s.tiles.killParticipation,
            a: percent(h.statsA.avgKillParticipation),
            b: percent(h.statsB.avgKillParticipation),
          },
        ]
      : [];

  return (
    <PageContainer>
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.breadcrumbs.home, href: '/' },
          { label: messages.publicNav.players, href: '/jugadores' },
          { label: names.a, href: `/jugadores/${h.a.username}` },
          { label: format(t.title, names) },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader
        title={format(t.title, names)}
        description={plural(t.gamesTogether, h.games, locale)}
      />
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-6">
          <PlayerSide player={h.a} wins={h.winsA} />
          <SwordsIcon aria-hidden className="size-8 text-text-muted" />
          <PlayerSide player={h.b} wins={h.winsB} />
        </CardContent>
      </Card>
      {h.statsA && h.statsB ? (
        <div className="grid items-center gap-6 md:grid-cols-2">
          <StatRadar
            className="mx-auto"
            axes={radarAxes(h.statsA)}
            compare={{
              label: names.b,
              values: RADAR_AXES.map((axis) => h.statsB?.radar[axis] ?? 0),
            }}
            label={format(t.title, names)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead className="text-right">{names.a}</TableHead>
                <TableHead className="text-right">{names.b}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="text-text-muted">{r.label}</TableCell>
                  <TableCell className="tabular text-right">{r.a}</TableCell>
                  <TableCell className="tabular text-right">{r.b}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<SwordsIcon />} title={t.noGames} />
      )}
    </PageContainer>
  );
}
