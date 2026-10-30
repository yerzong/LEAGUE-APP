import type { LeaderStat, TournamentStats } from '@league/contracts';
import { format } from '@league/i18n';
import {
  BarList,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@league/ui';
import { ChartNoAxesColumnIcon, CrownIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { Section } from '@/features/tournaments/components/tournament-facts';

import { decimal, gamesLabel, percent, winRate } from '../format';
import { ChampionIcon } from './champion-icon';

const s = messages.stats;
const t = s.tournament;

const DIGITS: Record<LeaderStat, number> = {
  kda: 2,
  damagePerMin: 0,
  csPerMin: 1,
  visionPerMin: 2,
  kills: 0,
};

/** Leaders by stat, champion meta and MVPs of a tournament. */
export function TournamentStatsView({ stats }: { stats: TournamentStats }) {
  if (stats.gamesWithData === 0)
    return (
      <Section id="estadisticas" title={t.title}>
        <EmptyState icon={<ChartNoAxesColumnIcon />} title={t.noData} />
      </Section>
    );
  const player = (p: { username: string; displayName: string | null }) => (
    <Link href={`/jugadores/${p.username}`}>{p.displayName ?? p.username}</Link>
  );
  return (
    <Section id="estadisticas" title={t.title}>
      <p className="text-sm text-text-muted">
        {format(t.coverage, {
          withData: String(stats.gamesWithData),
          played: String(stats.gamesPlayed),
        })}
      </p>

      {(stats.mvp || stats.weeklyMvps.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {stats.mvp && (
            <Card>
              <CardContent className="flex items-center gap-3">
                <CrownIcon aria-hidden className="size-8 text-accent-flash" />
                <span className="flex flex-col">
                  <span className="caps text-xs text-text-muted">{t.tournamentMvp}</span>
                  <span className="font-display text-xl">{player(stats.mvp.player)}</span>
                  <span className="text-xs text-text-muted">{gamesLabel(stats.mvp.games)}</span>
                </span>
              </CardContent>
            </Card>
          )}
          {stats.weeklyMvps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="caps text-sm">{t.weeklyMvps}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {stats.weeklyMvps.map((w) => (
                    <li
                      key={`${w.phaseName}-${String(w.round)}`}
                      className="flex justify-between gap-2"
                    >
                      <span className="text-text-muted">
                        {format(t.round, { phase: w.phaseName, round: String(w.round) })}
                      </span>
                      {player(w.player)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <h3 className="caps text-sm text-text-muted">{t.leaders}</h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {stats.leaders
          .filter((l) => l.entries.length > 0)
          .map((l) => (
            <Card key={l.stat}>
              <CardHeader>
                <CardTitle className="caps text-sm">{t.leaderStats[l.stat]}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarList
                  label={t.leaderStats[l.stat]}
                  items={l.entries.map((e) => ({
                    key: e.player.username,
                    label: player(e.player),
                    value: e.value,
                    display: decimal(e.value, DIGITS[l.stat]),
                    hint: gamesLabel(e.games),
                  }))}
                />
              </CardContent>
            </Card>
          ))}
      </div>

      {stats.champions.length > 0 && (
        <>
          <h3 className="caps text-sm text-text-muted">{t.champions}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.match.columns.champion}</TableHead>
                <TableHead className="text-right">{t.picks}</TableHead>
                <TableHead className="text-right">{t.bans}</TableHead>
                <TableHead className="text-right">{t.winRate}</TableHead>
                <TableHead className="text-right">{t.presence}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.champions.map((c) => (
                <TableRow key={c.champion.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <ChampionIcon champion={c.champion} size="sm" />
                      {c.champion.name}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right">{c.picks}</TableCell>
                  <TableCell className="tabular text-right">{c.bans}</TableCell>
                  <TableCell className="tabular text-right">
                    {c.picks > 0 ? percent(winRate(c.wins, c.picks)) : '—'}
                  </TableCell>
                  <TableCell className="tabular text-right">{percent(c.presence)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Section>
  );
}
