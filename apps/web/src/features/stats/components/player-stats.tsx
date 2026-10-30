import type { PlayerStats } from '@league/contracts';
import { format } from '@league/i18n';
import { Badge, BarList, Card, CardContent, EmptyState, TrendBars } from '@league/ui';
import { ChartNoAxesColumnIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { Section } from '@/features/tournaments/components/tournament-facts';
import { formatDate } from '@/lib/ui/dates';

import { decimal, gamesLabel, percent, record, shortDay, winRate } from '../format';
import { AchievementIcon } from './achievement-icon';
import { AggregateView } from './aggregate-view';
import { ChampionIcon } from './champion-icon';
import { FormStrip } from './form-strip';
import { HeadToHeadForm } from './head-to-head-form';

const s = messages.stats;
const t = s.player;

/** Pro-stats of the public player page (docs/08 §5). */
export function PlayerStatsView({ stats, name }: { stats: PlayerStats; name: string }) {
  const { overall, record: series } = stats;
  return (
    <>
      <Section id="estadisticas" title={t.title}>
        <div className="flex flex-wrap items-center gap-4">
          {series.matches > 0 && (
            <Badge variant="blue">
              {s.tiles.series}: {record(series.wins, series.losses)}
            </Badge>
          )}
          <FormStrip results={stats.form} />
        </div>
        {overall ? (
          <AggregateView name={name} stats={overall} />
        ) : (
          <EmptyState
            icon={<ChartNoAxesColumnIcon />}
            title={series.matches > 0 ? t.noData : t.noMatches}
          />
        )}
      </Section>

      {stats.champions.length > 0 && (
        <Section id="campeones" title={t.champions}>
          <BarList
            label={t.champions}
            items={stats.champions.map((c) => ({
              key: String(c.champion.id),
              label: c.champion.name,
              value: c.games,
              display: gamesLabel(c.games),
              media: <ChampionIcon champion={c.champion} />,
              hint: `${s.tiles.winRate} ${percent(winRate(c.wins, c.games))} · ${s.tiles.kda} ${decimal(c.kda, 2)}`,
            }))}
          />
        </Section>
      )}

      {stats.evolution.length > 0 && (
        <Section id="evolucion" title={t.evolution}>
          <TrendBars
            label={t.evolutionHint}
            points={stats.evolution.map((w) => ({
              key: w.weekStart,
              label: shortDay(w.weekStart),
              value: w.kda,
              display: decimal(w.kda),
            }))}
          />
          <p className="text-xs text-text-muted">{t.evolutionHint}</p>
        </Section>
      )}

      <Section id="logros" title={t.achievements}>
        {stats.achievements.length === 0 && stats.mvps.length === 0 ? (
          <p className="text-sm text-text-muted">{t.noAchievements}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.mvps.map((m, i) => (
              <li key={`mvp-${String(i)}`}>
                <Card className="h-full">
                  <CardContent className="flex items-center gap-3">
                    <AchievementIcon icon="crown" className="size-6 text-accent-flash" />
                    <span className="flex flex-col">
                      <span className="font-semibold">{s.mvpScopes[m.scope]}</span>
                      <span className="text-xs text-text-muted">
                        {m.tournament.name}
                        {m.round !== null &&
                          ` · ${format(t.roundLabel, { round: String(m.round) })}`}
                      </span>
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
            {stats.achievements.map((a) => (
              <li key={a.key}>
                <Card className="h-full">
                  <CardContent className="flex items-center gap-3">
                    <AchievementIcon icon={a.icon} className="size-6 text-brand-bright" />
                    <span className="flex flex-col">
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-xs text-text-muted">{a.description}</span>
                      <span className="text-xs text-text-muted">{formatDate(a.awardedAt)}</span>
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {stats.history.length > 0 && (
        <Section id="historial" title={t.history}>
          <ul className="flex flex-col gap-2">
            {stats.history.map((m) => (
              <li key={m.matchId}>
                <Link
                  href={`/torneos/${m.tournament.slug}/partidas/${m.matchId}`}
                  className="focus-ring block rounded-lg"
                >
                  <Card className="transition-colors hover:border-brand">
                    <CardContent className="flex flex-wrap items-center gap-3">
                      <Badge variant={m.result === 'win' ? 'success' : 'danger'}>
                        {m.result === 'win' ? s.form.winLabel : s.form.lossLabel} {m.scoreFor}–
                        {m.scoreAgainst}
                      </Badge>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">
                          {m.entrantName ? `${m.entrantName} ` : ''}
                          {format(t.versus, { name: m.opponentName ?? '—' })}
                        </span>
                        <span className="text-xs text-text-muted">
                          {m.tournament.name} · {formatDate(m.playedAt)}
                        </span>
                      </span>
                      <span className="flex gap-1">
                        {m.games.map((g, i) => (
                          <span key={i} className="flex items-center gap-1 text-xs">
                            <ChampionIcon champion={g.champion} size="sm" />
                            <span className="tabular">
                              {g.kills}/{g.deaths}/{g.assists}
                            </span>
                          </span>
                        ))}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {stats.tournaments.length > 0 && (
        <Section id="por-torneo" title={t.byTournament}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stats.tournaments.map(({ tournament, stats: st }) => (
              <li key={tournament.id}>
                <Card>
                  <CardContent className="flex flex-col gap-1">
                    <Link href={`/torneos/${tournament.slug}`} className="font-semibold">
                      {tournament.name}
                    </Link>
                    <span className="text-sm text-text-muted">
                      {gamesLabel(st.games)} · {s.tiles.winRate}{' '}
                      {percent(winRate(st.wins, st.games))} · {s.tiles.kda} {decimal(st.kda, 2)} ·{' '}
                      {s.tiles.csPerMin} {decimal(st.avgCsPerMin)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section id="head-to-head" title={t.compareTitle}>
        <p className="text-sm text-text-muted">{t.compareHint}</p>
        <HeadToHeadForm username={stats.player.username} />
      </Section>
    </>
  );
}
