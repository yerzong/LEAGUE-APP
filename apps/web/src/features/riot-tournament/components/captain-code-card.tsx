'use client';

import type { MatchCodes } from '@league/contracts';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, toast } from '@league/ui';
import { CopyIcon } from 'lucide-react';

import { messages } from '@/config/i18n';

const r = messages.riotTournament;

/** Match center: the active tournament code the captain pastes into the client. */
export function CaptainCodeCard({ codes }: { codes: MatchCodes }) {
  if (!codes.automatic) return null;
  const active = codes.codes.filter((c) => c.status === 'active' || c.status === 'used');
  if (active.length === 0) return null;

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success(r.captain.copied);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{r.captain.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">{r.captain.help}</p>
        {active.map((c) => (
          <div key={c.code} className="flex flex-wrap items-center gap-3">
            <span className="caps text-xs text-text-muted">
              {r.captain.game.replace('{n}', String(c.gameNumber))}
            </span>
            <code className="rounded bg-surface-2 px-3 py-1 text-base">{c.code}</code>
            <Badge variant={c.status === 'used' ? 'blue' : 'success'}>
              {r.codes.statuses[c.status]}
            </Badge>
            {c.status === 'active' && (
              <Button variant="ghost" size="sm" onClick={() => void copy(c.code)}>
                <CopyIcon />
                {r.captain.copy}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
