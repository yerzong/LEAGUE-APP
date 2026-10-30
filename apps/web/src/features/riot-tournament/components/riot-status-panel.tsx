'use client';

import type { RiotIntegrationStatus } from '@league/contracts';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, toast } from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { connectRiot } from '../actions';

const r = messages.riotTournament;

export function RiotStatusPanel({
  tournamentId,
  status,
}: {
  tournamentId: string;
  status: RiotIntegrationStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const connect = async () => {
    setPending(true);
    const result = await connectRiot(tournamentId);
    setPending(false);
    if (result.ok) {
      toast.success(r.connected);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  const manual = status.provider === 'manual';
  return (
    <Card>
      <CardHeader>
        <CardTitle>{r.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={status.connected ? 'success' : 'blue'}>
            {status.connected ? r.status.connected : r.status.disconnected}
          </Badge>
          <Badge variant={status.live ? 'success' : 'warning'}>
            {manual ? r.status.manual : status.live ? r.status.live : r.status.stub}
          </Badge>
          {status.supervision !== 'automatic' && (
            <Badge variant="warning">{r.status.notAutomatic}</Badge>
          )}
          {status.openIntegrityAlerts > 0 && (
            <Badge variant="danger">
              {r.status.alerts.replace('{count}', String(status.openIntegrityAlerts))}
            </Badge>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label={r.stats.tournamentId} value={status.riotTournamentId?.toString() ?? '—'} />
          <Stat label={r.stats.region} value={status.region ?? '—'} />
          <Stat label={r.stats.generated} value={String(status.codesGenerated)} />
          <Stat label={r.stats.used} value={String(status.codesUsed)} />
        </dl>
        {!manual && !status.connected && status.supervision === 'automatic' && (
          <div>
            <Button onClick={() => void connect()} disabled={pending}>
              {r.connect}
            </Button>
          </div>
        )}
        {status.recentCallbacks.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="caps text-xs text-text-muted">{r.callbacks.title}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {status.recentCallbacks.map((cb, i) => (
                <li key={`${cb.receivedAt}-${String(i)}`} className="flex items-center gap-2">
                  <Badge variant={cb.status === 'processed' ? 'success' : 'blue'}>
                    {r.callbacks.statuses[cb.status]}
                  </Badge>
                  <span className="text-text-muted">{cb.eventType}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="caps text-xs text-text-muted">{label}</dt>
      <dd className="font-display text-lg">{value}</dd>
    </div>
  );
}
