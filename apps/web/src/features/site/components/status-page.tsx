import type { ReactNode } from 'react';

import { brand } from '@/config/brand';

/** Branded full-width message for 404 and error pages, with ways out. */
export function StatusPage({
  code,
  title,
  description,
  actions,
}: {
  code: string;
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <section className="relative isolate flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-4 py-20 text-center">
      <div aria-hidden className="absolute inset-0 -z-10 hero-grid" />
      <p
        aria-hidden
        className="font-display text-8xl leading-none font-extrabold text-surface-2 tabular sm:text-9xl"
      >
        {code}
      </p>
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-brand-dim caps">{brand.name}</p>
        <h1 className="font-display text-3xl font-extrabold text-brand-bright caps">{title}</h1>
        <p className="max-w-md text-text-muted">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">{actions}</div>
    </section>
  );
}
