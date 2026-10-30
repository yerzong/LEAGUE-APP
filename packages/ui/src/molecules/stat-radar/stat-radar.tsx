import * as React from 'react';

import { cn } from '../../lib/cn.js';

export interface RadarAxis {
  readonly key: string;
  readonly label: string;
  /** 0–100. */
  readonly value: number;
}

export interface RadarSeries {
  readonly label: string;
  /** In the order of `axes`, 0–100. */
  readonly values: readonly number[];
}

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 80;
const RINGS = [25, 50, 75, 100];
const PAD = 56;

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Points of a polygon for `values` (0–100) on `count` axes, the first one pointing up. */
export function radarPoints(values: readonly number[], radius = RADIUS): string {
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
      const r = (clamp(v) / 100) * radius;
      return `${(CENTER + r * Math.cos(angle)).toFixed(1)},${(CENTER + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

export interface StatRadarProps extends Omit<React.ComponentProps<'figure'>, 'children'> {
  readonly axes: readonly RadarAxis[];
  /** What the chart shows, for screen readers (`Radar de Ana: …`). */
  readonly label: string;
  /** A second series drawn behind (head-to-head). */
  readonly compare?: RadarSeries;
}

/** PlayerStatRadar (docs/08 §5): five LCK-style axes, 0–100. */
function StatRadar({ axes, label, compare, className, ...props }: StatRadarProps) {
  const count = axes.length;
  const at = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  };
  return (
    <figure data-slot="stat-radar" className={cn('w-full max-w-sm', className)} {...props}>
      <svg
        viewBox={`${String(-PAD)} 0 ${String(SIZE + PAD * 2)} ${String(SIZE)}`}
        role="img"
        aria-label={label}
        className="w-full"
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={radarPoints(axes.map(() => ring))}
            className="fill-none stroke-border"
            strokeWidth={1}
          />
        ))}
        {axes.map((axis, i) => {
          const end = at(i, RADIUS);
          return (
            <line
              key={axis.key}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              className="stroke-border"
              strokeWidth={1}
            />
          );
        })}
        {compare && (
          <polygon
            data-series="compare"
            points={radarPoints(compare.values)}
            className="fill-team-red/15 stroke-team-red"
            strokeWidth={1.5}
          />
        )}
        <polygon
          data-series="main"
          points={radarPoints(axes.map((a) => a.value))}
          className="fill-brand/20 stroke-brand-bright"
          strokeWidth={2}
        />
        {axes.map((axis, i) => {
          const p = at(i, RADIUS + 16);
          const anchor = Math.abs(p.x - CENTER) < 4 ? 'middle' : p.x > CENTER ? 'start' : 'end';
          return (
            <text
              key={axis.key}
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-text-muted text-xs font-semibold uppercase"
            >
              {axis.label}
              <tspan className="fill-text" dx={4}>
                {Math.round(clamp(axis.value))}
              </tspan>
            </text>
          );
        })}
      </svg>
    </figure>
  );
}

export { StatRadar };
