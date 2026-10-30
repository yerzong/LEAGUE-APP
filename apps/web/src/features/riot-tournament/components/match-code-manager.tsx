'use client';

import type { TournamentCode } from '@league/contracts';
import { Badge, Button, Card, CardContent, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { generateRiotCode } from '../actions';

const r = messages.riotTournament;

export interface MatchRow {
  readonly id: string;
  readonly label: string;
  readonly codes: readonly TournamentCode[];
}

/** Staff: generate (or regenerate) the tournament code for each match. */
export function MatchCodeManager({
  tournamentId,
  matches,
}: {
  tournamentId: string;
  matches: readonly MatchRow[];
}) {
  if (matches.length === 0) return <p className="text-sm text-text-muted">{r.codes.none}</p>;
  return (
    <div className="flex flex-col gap-3">
      {matches.map((match) => (
        <MatchCodeCard key={match.id} tournamentId={tournamentId} match={match} />
      ))}
    </div>
  );
}

function MatchCodeCard({ tournamentId, match }: { tournamentId: string; match: MatchRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const active = match.codes.find((c) => c.status === 'active');

  const generate = async () => {
    setPending(true);
    const result = await generateRiotCode(tournamentId, match.id);
    setPending(false);
    if (result.ok) {
      toast.success(r.codes.generated);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-display">{match.label}</span>
          {active ? (
            <span className="flex items-center gap-2 text-sm">
              <code className="rounded bg-surface-2 px-2 py-0.5">{active.code}</code>
              <Badge variant="blue">{r.codes.statuses[active.status]}</Badge>
            </span>
          ) : (
            <span className="text-sm text-text-muted">{r.codes.noneYet}</span>
          )}
        </div>
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => void generate()}>
          {active ? r.codes.regenerate : r.codes.generate}
        </Button>
      </CardContent>
    </Card>
  );
}
