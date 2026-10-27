import type { ReactNode } from 'react';

import { cn } from '../../lib/cn.js';
import { SlideUp } from '../../motion/primitives.js';

export interface HeroProps {
  title: string;
  /** Small label above the title (season, circuit...). */
  eyebrow?: string | undefined;
  description?: string | undefined;
  /** Calls to action; the first one should be the primary button. */
  actions?: ReactNode;
  /** Logo or key art on the side (hidden behind the text on small screens). */
  media?: ReactNode;
  className?: string | undefined;
}

/** Opening block of a showcase page: brand, tagline and the main calls to action. */
export function Hero({ title, eyebrow, description, actions, media, className }: HeroProps) {
  return (
    <section
      data-slot="hero"
      className={cn('relative isolate overflow-hidden border-b border-border', className)}
    >
      <div aria-hidden className="absolute inset-0 -z-20 hero-grid" />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr]">
        <SlideUp className="flex flex-col gap-6">
          {eyebrow && (
            <p className="flex items-center gap-3 text-xs font-semibold text-brand-dim caps">
              <span aria-hidden className="h-px w-10 bg-brand-dim" />
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-4xl leading-none font-extrabold text-brand-bright caps sm:text-5xl">
            {title}
          </h1>
          {description && <p className="max-w-xl text-lg text-text-muted">{description}</p>}
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </SlideUp>
        {media && (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -bottom-16 -z-10 w-64 opacity-15 sm:w-80 lg:static lg:z-auto lg:mx-auto lg:w-full lg:max-w-sm lg:opacity-100"
          >
            {media}
          </div>
        )}
      </div>
    </section>
  );
}
