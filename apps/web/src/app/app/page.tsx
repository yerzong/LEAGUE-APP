import type { Metadata } from 'next';

import { messages } from '@/config/i18n';

export const metadata: Metadata = { title: messages.portal.title };

export default function PortalHomePage() {
  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-extrabold uppercase text-brand">
        {messages.portal.title}
      </h1>
      <p className="mt-2 text-text-muted">{messages.portal.subtitle}</p>
    </section>
  );
}
