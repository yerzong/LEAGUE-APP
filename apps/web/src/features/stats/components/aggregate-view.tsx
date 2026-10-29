import { RADAR_AXES, type PlayerAggregate } from '@league/contracts';
import { format } from '@league/i18n';
import { Stat, StatGrid, StatRadar } from '@league/ui';

import { messages } from '@/config/i18n';

import { decimal, gamesLabel, percent, winRate } from '../format';

const s = messages.stats;

export function radarAxes(stats: PlayerAggregate) {
  return RADAR_AXES.map((axis) => ({
    key: axis,
    label: s.radar.axes[axis],
    value: stats.radar[axis],
  }));
}

export function radarLabel(name: string, stats: PlayerAggregate) {
  return format(s.radar.label, {
    name,
    values: RADAR_AXES.map((a) => `${s.radar.axes[a]} ${String(stats.radar[a])}`).join(', '),
  });
}

/** The radar beside the main numbers of a player. */
export function AggregateView({ name, stats }: { name: string; stats: PlayerAggregate }) {
  return (
    <div className="grid items-center gap-6 md:grid-cols-3">
      <div className="flex flex-col items-center gap-2 md:col-span-1">
        <StatRadar axes={radarAxes(stats)} label={radarLabel(name, stats)} />
        <p className="text-center text-xs text-text-muted">{s.radar.hint}</p>
      </div>
      <StatGrid className="md:col-span-2 lg:grid-cols-4">
        <Stat label={s.tiles.games} value={stats.games} hint={`${String(stats.wins)}V`} />
        <Stat label={s.tiles.winRate} value={percent(winRate(stats.wins, stats.games))} />
        <Stat
          label={s.tiles.kda}
          value={decimal(stats.kda, 2)}
          hint={`${String(stats.kills)}/${String(stats.deaths)}/${String(stats.assists)}`}
        />
        <Stat label={s.tiles.csPerMin} value={decimal(stats.avgCsPerMin)} />
        <Stat label={s.tiles.damagePerMin} value={decimal(stats.avgDamagePerMin, 0)} />
        <Stat label={s.tiles.visionPerMin} value={decimal(stats.avgVisionPerMin, 2)} />
        <Stat label={s.tiles.killParticipation} value={percent(stats.avgKillParticipation)} />
        <Stat label={s.tiles.mvps} value={stats.mvps} hint={gamesLabel(stats.games)} />
      </StatGrid>
    </div>
  );
}
