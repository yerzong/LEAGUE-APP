'use client';

import {
  Button,
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
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { requestToJoin } from '../actions';

const t = messages.joinRequest;

export function JoinRequestButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const send = async () => {
    setPending(true);
    const result = await requestToJoin(teamId, message);
    setPending(false);
    if (result.ok) {
      toast.success(t.sent);
      setOpen(false);
      setMessage('');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t.request}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={messages.common.close}>
        <DialogHeader>
          <DialogTitle>{t.request}</DialogTitle>
          <DialogDescription>{teamName}</DialogDescription>
        </DialogHeader>
        <Field label={t.message}>
          {(control) => (
            <Textarea
              {...control}
              maxLength={280}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
              }}
            />
          )}
        </Field>
        <DialogFooter>
          <Button onClick={() => void send()} disabled={pending}>
            {t.request}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
