import { PageHeader } from '@league/ui';
import type { Metadata } from 'next';

import { messages } from '@/config/i18n';

export const metadata: Metadata = { title: messages.admin.title };

export default function AdminHomePage() {
  return <PageHeader title={messages.admin.title} description={messages.admin.subtitle} />;
}
