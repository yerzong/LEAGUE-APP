import { PageTransition } from '@league/ui';
import type { ReactNode } from 'react';

// template.tsx re-mounts on navigation, so the entrance replays per page.
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
