'use client';

import { Button, FormField } from '@league/ui';
import { useActionState } from 'react';

import { messages } from '@/config/i18n';

import { type AuthFormState, signUp } from '../actions';
import { FormMessage } from './form-message';

const initialState: AuthFormState = { status: 'idle' };
const { fields } = messages.auth;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <FormField label={fields.email} name="email" type="email" autoComplete="email" required />
      <FormField
        label={fields.password}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        hint={fields.passwordHint}
        required
      />
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>
        {messages.auth.register.submit}
      </Button>
    </form>
  );
}
