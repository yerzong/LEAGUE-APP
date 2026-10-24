import { Badge } from '@league/ui';

import { type Circuit, circuitNames } from '../demo-data';

// Full class names so Tailwind keeps them.
const colors = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['border', 'bg-border'],
  ['brand', 'bg-brand'],
  ['brand-bright', 'bg-brand-bright'],
  ['brand-dim', 'bg-brand-dim'],
  ['text', 'bg-text'],
  ['text-muted', 'bg-text-muted'],
  ['team-blue', 'bg-team-blue'],
  ['team-red', 'bg-team-red'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
] as const;

const accents: [Circuit, string][] = [
  ['league', 'bg-accent-league'],
  ['ascenso', 'bg-accent-ascenso'],
  ['flash', 'bg-accent-flash'],
  ['femenil', 'bg-accent-femenil'],
  ['uni', 'bg-accent-uni'],
];

export function Foundations() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {colors.map(([name, swatch]) => (
          <div key={name} className="flex flex-col gap-1">
            <div className={`h-12 rounded-sm border ${swatch}`} />
            <span className="text-xs text-text-muted">{name}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {accents.map(([circuit, swatch]) => (
          <div key={circuit} className="flex flex-col gap-2 rounded-sm border bg-surface p-3">
            <div className={`h-1 rounded-xs ${swatch}`} />
            <Badge variant={circuit}>{circuitNames[circuit]}</Badge>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-display text-5xl font-extrabold text-brand caps">Display 5xl</p>
        <p className="font-display text-3xl font-bold caps">Display 3xl</p>
        <p className="text-xl">Inter xl — cuerpo grande</p>
        <p className="text-base">Inter base — texto de lectura</p>
        <p className="text-sm text-text-muted">Inter sm — secundario</p>
        <p className="text-2xl tabular">12 / 1 / 9 · 1,234,567</p>
      </div>
    </div>
  );
}
