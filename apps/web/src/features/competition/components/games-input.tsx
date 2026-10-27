'use client';

import type { ReportedGameInput, SeriesFormat } from '@league/contracts';
import { format } from '@league/i18n';
import { Button, Label, RadioGroup, RadioGroupItem } from '@league/ui';
import { useId } from 'react';

import { messages } from '@/config/i18n';

const r = messages.competition.portal.report;
const MAX: Readonly<Record<SeriesFormat, number>> = { bo1: 1, bo3: 3, bo5: 5 };

/** Winner of each game of the series; the API scores it with packages/core. */
export function GamesInput({
  format: series,
  names,
  value,
  onChange,
}: {
  format: SeriesFormat;
  names: { a: string; b: string };
  value: ReportedGameInput[];
  onChange: (games: ReportedGameInput[]) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      {value.map((game, index) => (
        <fieldset key={game.number} className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-text">
            {format(r.gameWinner, { n: game.number })}
          </legend>
          <RadioGroup
            value={game.winner}
            onValueChange={(winner) => {
              onChange(
                value.map((g, i) => (i === index ? { ...g, winner: winner as 'a' | 'b' } : g)),
              );
            }}
            className="flex flex-wrap gap-4"
          >
            {(['a', 'b'] as const).map((slot) => (
              <Label
                key={slot}
                htmlFor={`${id}-${String(game.number)}-${slot}`}
                className="flex items-center gap-2 font-normal"
              >
                <RadioGroupItem id={`${id}-${String(game.number)}-${slot}`} value={slot} />
                {names[slot]}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
      ))}
      {MAX[series] > 1 && (
        <div className="flex flex-wrap gap-2">
          {value.length < MAX[series] && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onChange([...value, { number: value.length + 1, winner: 'a' }]);
              }}
            >
              {r.addGame}
            </Button>
          )}
          {value.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(value.slice(0, -1));
              }}
            >
              {r.removeGame}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Starting point of the form: the minimum number of games, all won by the first slot. */
export function initialGames(series: SeriesFormat): ReportedGameInput[] {
  const needed = Math.ceil(MAX[series] / 2);
  return Array.from({ length: needed }, (_, i) => ({ number: i + 1, winner: 'a' as const }));
}
