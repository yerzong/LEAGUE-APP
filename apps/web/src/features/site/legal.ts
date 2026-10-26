import { format } from '@league/i18n';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';

const docs = messages.legal.docs;

export type LegalSlug = keyof typeof docs;

export interface LegalDoc {
  slug: LegalSlug;
  title: string;
  description: string;
  sections: { title: string; body: string[] }[];
}

const withBrand = (text: string) => format(text, { brand: brand.name });

/** Static legal pages (docs/10-legal-cumplimiento.md), in footer order. */
export const legalDocs: readonly LegalDoc[] = (
  ['reglamento', 'conducta', 'privacidad', 'terminos'] as const
).map((slug) => ({
  slug,
  title: docs[slug].title,
  description: withBrand(docs[slug].description),
  sections: docs[slug].sections.map((section) => ({
    title: section.title,
    body: section.body.map(withBrand),
  })),
}));

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return legalDocs.find((doc) => doc.slug === slug);
}
