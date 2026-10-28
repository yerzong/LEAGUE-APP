'use client';

// Loaded only through ./autofill (behind the dev flag). It fills the form;
// it never submits: the person reviews and saves.

import type { CreateTeamInput, TournamentConfigInput, UpdateProfileInput } from '@league/contracts';
import { Button, toast } from '@league/ui';
import { WandSparklesIcon } from 'lucide-react';

import { messages } from '@/config/i18n';

import { devToolsEnabled } from './enabled';
import { sampleProfile, sampleTeam, sampleTournament } from './samples';

function AutofillButton({ onClick }: { onClick: () => void }) {
  if (!devToolsEnabled(process.env.NEXT_PUBLIC_DEV_TOOLS, process.env.NEXT_PUBLIC_SUPABASE_URL))
    return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-dev-tool="autofill"
      onClick={() => {
        onClick();
        toast.info(messages.devTools.filled);
      }}
    >
      <WandSparklesIcon aria-hidden /> {messages.devTools.autofill}
    </Button>
  );
}

export function ProfileAutofill({ onFill }: { onFill: (values: UpdateProfileInput) => void }) {
  return (
    <AutofillButton
      onClick={() => {
        onFill(sampleProfile());
      }}
    />
  );
}

export function TeamAutofill({ onFill }: { onFill: (values: CreateTeamInput) => void }) {
  return (
    <AutofillButton
      onClick={() => {
        onFill(sampleTeam());
      }}
    />
  );
}

export function TournamentAutofill({
  onFill,
}: {
  onFill: (values: TournamentConfigInput) => void;
}) {
  return (
    <AutofillButton
      onClick={() => {
        onFill(sampleTournament());
      }}
    />
  );
}
