'use client';

import type { FollowableType, FollowState } from '@league/contracts';
import { format, plural } from '@league/i18n';
import { Button, toast } from '@league/ui';
import { BellIcon, BellOffIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { locale, messages } from '@/config/i18n';

import { follow, unfollow } from '../actions';

const t = messages.stats.follow;

/** Follow / unfollow, with the public follower count (never who follows). */
export function FollowButton({
  type,
  targetKey,
  name,
  initial,
  loginHref,
  compact = false,
}: {
  type: FollowableType;
  targetKey: string;
  name: string;
  initial: FollowState;
  /** Set when there is no session: the button sends to the login. */
  loginHref?: string | undefined;
  /** Without the follower count (lists of the user's own follows). */
  compact?: boolean;
}) {
  const [state, setState] = useState(initial);
  const [pending, setPending] = useState(false);
  const count = plural(t.followers, state.followers, locale);

  if (loginHref)
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted">{count}</span>
        <Button asChild variant="secondary">
          <Link href={loginHref}>
            <BellIcon />
            {t.follow}
          </Link>
        </Button>
      </div>
    );

  const toggle = async () => {
    setPending(true);
    const request = { type, key: targetKey };
    const result = state.following ? await unfollow(request) : await follow(request);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(format(result.data.following ? t.followed : t.unfollowed, { name }));
    setState(result.data);
  };

  return (
    <div className="flex items-center gap-3">
      {!compact && (
        <span className="text-sm text-text-muted" aria-live="polite">
          {count}
        </span>
      )}
      <Button
        variant={state.following ? 'secondary' : 'primary'}
        disabled={pending}
        aria-pressed={state.following}
        title={t.privacy}
        onClick={() => void toggle()}
      >
        {state.following ? <BellOffIcon /> : <BellIcon />}
        {state.following ? t.unfollow : t.follow}
      </Button>
    </div>
  );
}
