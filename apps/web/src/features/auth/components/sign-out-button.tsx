import { Button } from '@league/ui';

import { messages } from '@/config/i18n';

import { signOut } from '../actions';

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        {messages.auth.signOut}
      </Button>
    </form>
  );
}
