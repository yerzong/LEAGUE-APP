import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';
import { defaultRenderLink, type RenderLink } from '../../lib/link.js';

export interface BracketSlot {
  /** Entrant name, or the placeholder of an empty slot ("Ganador de R1-M1"). */
  name: string;
  tag?: string | undefined;
  score?: number | undefined;
  winner?: boolean | undefined;
  /** Not decided yet: shown muted. */
  placeholder?: boolean | undefined;
}

export interface BracketMatch {
  id: string;
  a: BracketSlot;
  b: BracketSlot;
  /** Status or time line, already formatted by the app. */
  meta?: ReactNode;
  href?: string | undefined;
  /** Highlight (live, needs attention). */
  live?: boolean | undefined;
}

export interface BracketRound {
  id: string;
  title: string;
  matches: BracketMatch[];
}

export interface BracketProps {
  rounds: BracketRound[];
  /** Accessible name of the bracket (i18n from the app). */
  label: string;
  renderLink?: RenderLink | undefined;
  className?: string | undefined;
}

function Slot({ slot }: { slot: BracketSlot }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-1.5 text-sm',
        slot.winner ? 'font-semibold text-text' : 'text-text-muted',
        slot.placeholder && 'italic',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {slot.tag && <span className="shrink-0 text-xs text-text-muted caps">{slot.tag}</span>}
        <span className="truncate">{slot.name}</span>
      </span>
      {slot.score !== undefined && <span className="tabular">{slot.score}</span>}
    </div>
  );
}

/** Elimination bracket: one column per round, matches linked to their page. */
export function Bracket({
  rounds,
  label,
  renderLink = defaultRenderLink,
  className,
}: BracketProps) {
  return (
    <div role="group" aria-label={label} className={cn('overflow-x-auto pb-2', className)}>
      <ol className="flex min-w-max gap-4">
        {rounds.map((round) => (
          <li key={round.id} className="flex w-56 flex-col gap-3">
            <h4 className="text-xs text-text-muted caps">{round.title}</h4>
            <ol className="flex flex-1 flex-col justify-around gap-3">
              {round.matches.map((match) => {
                const card = (
                  <div
                    className={cn(
                      'divide-y divide-border rounded-md border bg-surface transition-colors',
                      match.live ? 'border-brand' : 'border-border',
                      match.href && 'hover:border-brand',
                    )}
                  >
                    <Slot slot={match.a} />
                    <Slot slot={match.b} />
                    {match.meta && (
                      <div className="px-3 py-1 text-xs text-text-muted">{match.meta}</div>
                    )}
                  </div>
                );
                return (
                  <li key={match.id}>
                    {match.href
                      ? renderLink({
                          href: match.href,
                          className: 'block rounded-md focus-ring',
                          children: card,
                        })
                      : card}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
