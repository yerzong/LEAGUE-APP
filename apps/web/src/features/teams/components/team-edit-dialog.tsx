'use client';

import type { TeamDetail } from '@league/contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@league/ui';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';

import { messages } from '@/config/i18n';

import { TeamForm } from './team-form';

export function TeamEditDialog({ team }: { team: TeamDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <PencilIcon />
          {messages.teams.edit}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={messages.common.close}>
        <DialogHeader>
          <DialogTitle>{messages.teams.edit}</DialogTitle>
        </DialogHeader>
        <TeamForm
          team={team}
          onSaved={() => {
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
