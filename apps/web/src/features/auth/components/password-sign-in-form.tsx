'use client';

import { Button, FormField } from '@league/ui';
import { useActionState } from 'react';

import { messages } from '@/config/i18n';

import { type AuthFormState, signInWithPassword } from '../actions';
import { FormMessage } from './form-message';

const initialState: AuthFormState = { status: 'idle' };
const { fields } = messages.auth;

export function PasswordSignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <FormField label={fields.email} name="email" type="email" autoComplete="email" required />
      <FormField
        label={fields.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {messages.auth.login.submit}
      </Button>
    </form>
  );
}
