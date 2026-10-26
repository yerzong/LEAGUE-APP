import type { Metadata } from 'next';

import { brand } from '@/config/brand';

/** Open Graph fields every page repeats (Next replaces, not merges, `openGraph`). */
export const baseOpenGraph = { siteName: brand.name, locale: 'es_419', type: 'website' } as const;

interface PageMetadataInput {
  title: string;
  description: string;
  /** Canonical path of the page (`/equipos/aurora`). */
  path: string;
  /** Picture for link previews (team logo, avatar). */
  image?: string | null | undefined;
}

/** Title, description, canonical URL and Open Graph for a public page. */
export function pageMetadata({ title, description, path, image }: PageMetadataInput): Metadata {
  const images = image ? [{ url: image, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...baseOpenGraph, title, description, url: path, ...(images ? { images } : {}) },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}
