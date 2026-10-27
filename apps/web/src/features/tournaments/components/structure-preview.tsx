import type { TournamentConfig, TournamentDetail } from '@league/contracts';
import { format } from '@league/i18n';

import { messages } from '@/config/i18n';

const r = messages.tournaments.wizard.review;

/** Phase shapes computed by the API with the format strategies of packages/core. */
export function StructurePreview({
  config,
  preview,
}: {
  config: TournamentConfig;
  preview: TournamentDetail['preview'];
}) {
  const capacity = config.capacity.capacity;
  if (capacity === null) return <p className="text-sm text-text-muted">{r.previewNoCapacity}</p>;
  if (preview.error)
    return <p className="text-sm text-danger">{format(r.previewError, { capacity })}</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">{format(r.previewHint, { capacity })}</p>
      <ol className="flex flex-col gap-2">
        {preview.shapes.map((shape, index) => {
          const phase = config.format.phases[index];
          return (
            <li key={String(index)} className="rounded-sm border border-border px-3 py-2">
              <span className="font-semibold text-text">
                {index + 1}. {phase?.name} ·{' '}
                {phase ? messages.tournaments.options.formats[phase.format] : ''}
              </span>
              <span className="block text-sm text-text-muted">
                {shape.groups.length > 0
                  ? format(r.shapeGroups, {
                      entrants: shape.entrants,
                      groups: shape.groups.length,
                      sizes: shape.groups.join(' / '),
                      matches: shape.matches,
                    })
                  : format(r.shape, {
                      entrants: shape.entrants,
                      rounds: shape.rounds,
                      matches: shape.matches,
                    })}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
