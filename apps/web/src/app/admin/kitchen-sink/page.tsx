import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { isKitchenSinkEnabled } from '@/config/kitchen-sink';
import { KitchenSink } from '@/features/kitchen-sink/kitchen-sink';

export const metadata: Metadata = { title: messages.kitchenSink.title };

// super_admin only (admin layout); hidden in production unless explicitly enabled.
export default function KitchenSinkPage() {
  if (!isKitchenSinkEnabled()) notFound();
  return <KitchenSink />;
}
