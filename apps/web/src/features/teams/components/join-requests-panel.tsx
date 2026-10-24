'use client';

import type { TeamDetail } from '@league/contracts';
import { Button, Card, CardContent, CardHeader, CardTitle, toast } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';
import { formatDate } from '@/lib/ui/dates';

import { decideJoinRequest } from '../actions';

const t = messages.teams.requests;

export function JoinRequestsPanel({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const decide = async (requestId: string, decision: 'approve' | 'decline') => {
    const result = await decideJoinRequest(team.id, requestId, { decision, teamRole: 'player' });
    if (result.ok) {
      toast.success(decision === 'approve' ? t.approved : t.declined);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {team.joinRequests.length === 0 && <p className="text-sm text-text-muted">{t.empty}</p>}
        <ul className="flex flex-col gap-3">
          {team.joinRequests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-col">
                <span>{request.user.displayName ?? request.user.username}</span>
                {request.message && (
                  <span className="text-sm text-text-muted">{request.message}</span>
                )}
                <span className="text-xs text-text-muted">{formatDate(request.createdAt)}</span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => void decide(request.id, 'approve')}>
                  {t.approve}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void decide(request.id, 'decline')}
                >
                  {t.decline}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
