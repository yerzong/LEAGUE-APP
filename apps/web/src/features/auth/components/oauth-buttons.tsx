import { Button } from '@league/ui';

import { messages } from '@/config/i18n';

import { signInWithOAuth } from '../actions';

export interface OAuthButtonsProps {
  next: string;
  googleEnabled: boolean;
}

export function OAuthButtons({ next, googleEnabled }: OAuthButtonsProps) {
  return (
    <form action={signInWithOAuth} className="flex flex-col gap-2">
      <input type="hidden" name="next" value={next} />
      <Button type="submit" name="provider" value="discord" size="lg" className="w-full">
        {messages.auth.oauth.discord}
      </Button>
      {googleEnabled && (
        <Button type="submit" name="provider" value="google" variant="secondary" className="w-full">
          {messages.auth.oauth.google}
        </Button>
      )}
    </form>
  );
}
