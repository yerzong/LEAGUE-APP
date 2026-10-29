import type { MatchStats } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@league/ui';
import Link from 'next/link';

import { messages } from '@/config/i18n';
import { Section } from '@/features/tournaments/components/tournament-facts';

import { duration } from '../format';
import { ChampionIcon } from './champion-icon';

const s = messages.stats;
const t = s.match;

/** Per-game box score; a game without match data shows only that it was played. */
export function MatchBoxScore({
  stats,
  names,
}: {
  stats: MatchStats;
  /** Registration names by id. */
  names: ReadonlyMap<string, string>;
}) {
  if (stats.games.length === 0) return null;
  return (
    <Section id="estadisticas" title={t.title}>
      {stats.games.map((game) => (
        <Card key={game.number}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="caps text-sm">
              {format(t.game, { number: String(game.number) })}
            </CardTitle>
            {game.durationSeconds !== null && (
              <span className="text-xs text-text-muted">
                {format(t.duration, { duration: duration(game.durationSeconds) })}
              </span>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!game.hasData && <p className="text-sm text-text-muted">{t.noData}</p>}
            {game.teams.map((team) => (
              <div key={team.side} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={team.side}>{t.sides[team.side]}</Badge>
                  <span className="font-semibold">{names.get(team.entrantId) ?? ''}</span>
                  <Badge variant={team.win ? 'success' : 'danger'}>
                    {team.win ? t.win : t.loss}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    {format(t.objectives, {
                      kills: String(team.kills),
                      towers: String(team.towers),
                      dragons: String(team.dragons),
                      barons: String(team.barons),
                    })}
                  </span>
                </div>
                {team.bans.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="caps mr-1 text-xs text-text-muted">{t.bans}</span>
                    {team.bans.map((c, i) => (
                      <ChampionIcon
                        key={`${String(c.id)}-${String(i)}`}
                        champion={c}
                        size="sm"
                        className="opacity-60 grayscale"
                      />
                    ))}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.columns.player}</TableHead>
                      <TableHead>{t.columns.champion}</TableHead>
                      <TableHead className="text-right">{t.columns.kda}</TableHead>
                      <TableHead className="text-right">{t.columns.cs}</TableHead>
                      <TableHead className="text-right">{t.columns.gold}</TableHead>
                      <TableHead className="text-right">{t.columns.damage}</TableHead>
                      <TableHead className="text-right">{t.columns.vision}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.players.map((p, i) => (
                      <TableRow key={`${p.name}-${String(i)}`}>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            {p.player ? (
                              <Link href={`/jugadores/${p.player.username}`}>{p.name}</Link>
                            ) : (
                              p.name
                            )}
                            {p.isMvp && <Badge variant="flash">{t.mvp}</Badge>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <ChampionIcon champion={p.champion} size="sm" />
                            {p.champion.name}
                          </span>
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {p.kills}/{p.deaths}/{p.assists}
                        </TableCell>
                        <TableCell className="tabular text-right">{p.cs}</TableCell>
                        <TableCell className="tabular text-right">{p.gold}</TableCell>
                        <TableCell className="tabular text-right">{p.damage}</TableCell>
                        <TableCell className="tabular text-right">{p.visionScore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </Section>
  );
}
