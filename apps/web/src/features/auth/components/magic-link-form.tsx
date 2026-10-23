'use client';

import { Button, FormField } from '@league/ui';
import { useActionState } from 'react';

import { messages } from '@/config/i18n';

import { type AuthFormState, sendMagicLink } from '../actions';
import { FormMessage } from './form-message';

const initialState: AuthFormState = { status: 'idle' };

export function MagicLinkForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <FormField
        label={messages.auth.fields.email}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {messages.auth.magicLink.submit}
      </Button>
    </form>
  );
}
