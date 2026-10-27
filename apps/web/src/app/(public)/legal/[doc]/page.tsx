import { Breadcrumbs, PageHeader } from '@league/ui';
import { InfoIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { messages } from '@/config/i18n';
import { findLegalDoc, legalDocs } from '@/features/site/legal';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';
import { renderRouterLink } from '@/lib/ui/router-link';

const t = messages.legal;

export const dynamicParams = false;

export function generateStaticParams() {
  return legalDocs.map((doc) => ({ doc: doc.slug }));
}

export async function generateMetadata({ params }: PageProps<'/legal/[doc]'>): Promise<Metadata> {
  const doc = findLegalDoc((await params).doc);
  if (!doc) return {};
  return pageMetadata({
    title: doc.title,
    description: doc.description,
    path: `/legal/${doc.slug}`,
  });
}

export default async function LegalDocPage({ params }: PageProps<'/legal/[doc]'>) {
  const doc = findLegalDoc((await params).doc);
  if (!doc) notFound();

  return (
    <PageContainer className="max-w-3xl">
      <Breadcrumbs
        label={messages.breadcrumbs.label}
        items={[
          { label: messages.breadcrumbs.home, href: '/' },
          { label: t.title, href: '/legal' },
          { label: doc.title },
        ]}
        renderLink={renderRouterLink}
      />
      <PageHeader title={doc.title} description={doc.description} />
      <p className="flex gap-2 rounded-md border bg-surface p-4 text-sm text-text-muted">
        <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-dim" />
        {t.preliminary}
      </p>
      <article className="flex flex-col gap-8">
        {doc.sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold text-text caps">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
      <nav aria-label={t.otherDocs} className="flex flex-col gap-3 border-t pt-6">
        <p className="text-xs font-semibold text-brand-dim caps">{t.otherDocs}</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {legalDocs
            .filter((other) => other.slug !== doc.slug)
            .map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/legal/${other.slug}`}
                  className="focus-ring text-sm text-brand underline"
                >
                  {other.title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </PageContainer>
  );
}
