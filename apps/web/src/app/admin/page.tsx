import type { Metadata } from 'next';

import { messages } from '@/config/i18n';

export const metadata: Metadata = { title: messages.admin.title };

export default function AdminHomePage() {
  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-extrabold uppercase text-brand">
        {messages.admin.title}
      </h1>
      <p className="mt-2 text-text-muted">{messages.admin.subtitle}</p>
    </section>
  );
}
