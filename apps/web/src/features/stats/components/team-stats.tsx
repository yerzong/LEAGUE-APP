import type { TeamStats } from '@league/contracts';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  EmptyState,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@league/ui';
import { ChartNoAxesColumnIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { Section } from '@/features/tournaments/components/tournament-facts';
import { initials } from '@/lib/ui/dates';

import { decimal, duration, percent, record, winRate } from '../format';
import { ChampionIcon } from './champion-icon';
import { FormStrip } from './form-strip';

const s = messages.stats;
const t = s.team;

/** Team numbers, recent form and the roster with mini-stats. */
export function TeamStatsView({ stats, teamSlug }: { stats: TeamStats; teamSlug: string }) {
  const { overall } = stats;
  return (
    <Section id="estadisticas" title={t.title}>
      <div className="flex flex-wrap items-center gap-4">
        {stats.record.matches > 0 && (
          <Badge variant="blue">
            {s.tiles.series}: {record(stats.record.wins, stats.record.losses)}
          </Badge>
        )}
        <FormStrip results={stats.form} />
      </div>
      {overall ? (
        <StatGrid>
          <Stat label={s.tiles.games} value={overall.games} hint={`${String(overall.wins)}V`} />
          <Stat label={s.tiles.winRate} value={percent(winRate(overall.wins, overall.games))} />
          <Stat label={s.tiles.avgDuration} value={duration(overall.avgDurationSeconds)} />
          <Stat label={s.tiles.avgKills} value={decimal(overall.avgKills)} />
          <Stat label={s.tiles.avgTowers} value={decimal(overall.avgTowers)} />
          <Stat label={s.tiles.avgDragons} value={decimal(overall.avgDragons)} />
          <Stat label={s.tiles.firstBloodRate} value={percent(overall.firstBloodRate)} />
          <Stat label={s.tiles.firstTowerRate} value={percent(overall.firstTowerRate)} />
        </StatGrid>
      ) : (
        <EmptyState
          icon={<ChartNoAxesColumnIcon />}
          title={stats.record.matches > 0 ? t.noData : t.noMatches}
        />
      )}
      {overall && stats.roster.length > 0 && (
        <>
          <h3 className="caps text-sm text-text-muted">{t.roster}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.match.columns.player}</TableHead>
                <TableHead>{t.topChampion}</TableHead>
                <TableHead className="text-right">{s.tiles.games}</TableHead>
                <TableHead className="text-right">{s.tiles.kda}</TableHead>
                <TableHead className="text-right">{s.tiles.csPerMin}</TableHead>
                <TableHead className="text-right">{s.tiles.killParticipation}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.roster.map((r) => {
                const name = r.player.displayName ?? r.player.username;
                return (
                  <TableRow key={r.player.username}>
                    <TableCell>
                      <Link
                        href={`/jugadores/${r.player.username}?equipo=${teamSlug}`}
                        className="flex items-center gap-2"
                      >
                        <Avatar size="sm">
                          {r.player.avatarUrl && <AvatarImage src={r.player.avatarUrl} alt="" />}
                          <AvatarFallback>{initials(name)}</AvatarFallback>
                        </Avatar>
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.topChampion ? (
                        <span className="flex items-center gap-2">
                          <ChampionIcon champion={r.topChampion} size="sm" />
                          {r.topChampion.name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">{r.stats?.games ?? 0}</TableCell>
                    <TableCell className="tabular text-right">
                      {r.stats ? decimal(r.stats.kda, 2) : '—'}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {r.stats ? decimal(r.stats.avgCsPerMin) : '—'}
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {r.stats ? percent(r.stats.avgKillParticipation) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </Section>
  );
}
