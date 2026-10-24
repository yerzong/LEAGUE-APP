'use client';

import { PageHeader } from '@league/ui';

import { messages } from '@/config/i18n';

import { Buttons, Forms, Indicators } from './sections/controls';
import { DataDemo } from './sections/data';
import { Foundations } from './sections/foundations';
import { MotionDemo } from './sections/motion';
import { Navigation } from './sections/navigation';
import { Overlays } from './sections/overlays';
import { Section } from './sections/section';
import { States } from './sections/states';
import { Surfaces } from './sections/surfaces';

const t = messages.kitchenSink;

/** Every design-system component and state, for visual approval. Development only. */
export function KitchenSink() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
      <Section title={t.sections.foundations}>
        <Foundations />
      </Section>
      <Section title={t.sections.buttons}>
        <Buttons />
      </Section>
      <Section title={t.sections.forms}>
        <Forms />
      </Section>
      <Section title={t.sections.indicators}>
        <Indicators />
      </Section>
      <Section title={t.sections.surfaces}>
        <Surfaces />
      </Section>
      <Section title={t.sections.overlays}>
        <Overlays />
      </Section>
      <Section title={t.sections.navigation}>
        <Navigation />
      </Section>
      <Section title={t.sections.data}>
        <DataDemo />
      </Section>
      <Section title={t.sections.states}>
        <States />
      </Section>
      <Section title={t.sections.motion}>
        <MotionDemo />
      </Section>
    </div>
  );
}
