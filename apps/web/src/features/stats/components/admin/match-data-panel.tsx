'use client';

import type { MatchDataStatus } from '@league/contracts';
import { format } from '@league/i18n';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Textarea,
  toast,
} from '@league/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { attachMatchData } from '../../actions';

const t = messages.stats.admin.matchData;

function UploadDialog({
  gameId,
  number,
  replace,
}: {
  gameId: string;
  number: number;
  replace: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState('');
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    const result = await attachMatchData(gameId, json);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t.saved);
    setOpen(false);
    setJson('');
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          {replace ? t.replace : t.upload}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={messages.common.close}>
        <DialogHeader>
          <DialogTitle>{format(t.game, { number: String(number) })}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
        </DialogHeader>
        <Field label={t.label}>
          {(control) => (
            <Textarea
              {...control}
              rows={10}
              className="h-64 font-mono text-xs field-sizing-fixed"
              spellCheck={false}
              value={json}
              onChange={(event) => {
                setJson(event.target.value);
              }}
            />
          )}
        </Field>
        <DialogFooter>
          <Button disabled={pending || json.trim() === ''} onClick={() => void save()}>
            {t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Staff: the Match-V5 data of each game (the manual path until the Riot integration). */
export function MatchDataPanel({ status }: { status: MatchDataStatus }) {
  const games = status.games.filter((g) => g.completed);
  if (games.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {games.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{format(t.game, { number: String(g.number) })}</span>
              <Badge variant={g.hasData ? 'success' : 'warning'}>
                {g.hasData ? t.hasData : t.noData}
              </Badge>
              {g.riotMatchId && <span className="text-xs text-text-muted">{g.riotMatchId}</span>}
              <span className="ml-auto">
                <UploadDialog gameId={g.id} number={g.number} replace={g.hasData} />
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
