'use client';

// The autofill buttons, or null. Next.js inlines NEXT_PUBLIC_DEV_TOOLS (always
// defined in next.config.ts); each condition is written literally so the
// bundler sees "false" === "true", drops the dynamic import and never emits the
// chunk with the buttons and the sample data.
import dynamic from 'next/dynamic';

export const ProfileAutofill =
  process.env.NEXT_PUBLIC_DEV_TOOLS === 'true'
    ? dynamic(() => import('./autofill-buttons').then((m) => m.ProfileAutofill), { ssr: false })
    : null;

export const TeamAutofill =
  process.env.NEXT_PUBLIC_DEV_TOOLS === 'true'
    ? dynamic(() => import('./autofill-buttons').then((m) => m.TeamAutofill), { ssr: false })
    : null;

export const TournamentAutofill =
  process.env.NEXT_PUBLIC_DEV_TOOLS === 'true'
    ? dynamic(() => import('./autofill-buttons').then((m) => m.TournamentAutofill), { ssr: false })
    : null;
