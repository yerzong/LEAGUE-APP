import { Button } from '@league/ui';
import { GlobeIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';

/** From /app and /admin back to the public site. */
export function BackToSiteLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/">
        <GlobeIcon />
        <span className="hidden sm:inline">{messages.shell.backToSite}</span>
        <span className="sr-only sm:hidden">{messages.shell.backToSite}</span>
      </Link>
    </Button>
  );
}
