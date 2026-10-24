import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';

export const metadata: Metadata = { title: messages.portal.title };

export default function PortalHomePage() {
  return <PageHeader title={messages.portal.title} description={messages.portal.subtitle} />;
}
