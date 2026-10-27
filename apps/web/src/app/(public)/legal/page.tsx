import { format } from '@league/i18n';
import { Card, CardContent, PageHeader } from '@league/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { legalDocs } from '@/features/site/legal';
import { PageContainer } from '@/features/site/components/page-container';
import { pageMetadata } from '@/features/site/metadata';

const t = messages.legal;
const description = format(t.description, { brand: brand.name });

export const metadata: Metadata = pageMetadata({ title: t.title, description, path: '/legal' });

export default function LegalIndexPage() {
  return (
    <PageContainer>
      <PageHeader title={t.title} description={description} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {legalDocs.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/legal/${doc.slug}`} className="focus-ring block h-full rounded-lg">
              <Card className="h-full transition-colors hover:border-brand">
                <CardContent className="flex flex-col gap-2">
                  <h2 className="font-display text-xl font-bold text-text caps">{doc.title}</h2>
                  <p className="text-sm text-text-muted">{doc.description}</p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
