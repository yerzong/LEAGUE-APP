import { format, plural } from '@league/i18n';
import { Button, EmptyState, PageHeader } from '@league/ui';
import { SearchXIcon, ShieldIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { getSessionUser } from '@/features/auth/session';
import { LoadError } from '@/features/shell/load-error';
import { listPublicTeams } from '@/features/site/api';
import { DirectoryPagination } from '@/features/site/components/directory-pagination';
import { DirectorySearch } from '@/features/site/components/directory-search';
import { PageContainer } from '@/features/site/components/page-container';
import { readDirectoryParams } from '@/features/site/directory-params';
import { pageMetadata } from '@/features/site/metadata';
import { TeamCard } from '@/features/teams/components/team-card';

const t = messages.teamsPage;
const description = format(t.description, { brand: brand.name });

export const metadata: Metadata = pageMetadata({ title: t.title, description, path: '/equipos' });

export default async function TeamsDirectoryPage({ searchParams }: PageProps<'/equipos'>) {
  const { query, invalid } = readDirectoryParams(await searchParams);
  const [result, user] = await Promise.all([listPublicTeams(query), getSessionUser()]);
  const createHref = user ? '/app/equipos/nuevo' : '/register';

  return (
    <PageContainer>
      <PageHeader
        title={t.title}
        description={description}
        actions={
          <Button asChild variant="outline">
            <Link href={createHref}>{t.create}</Link>
          </Button>
        }
      />
      <DirectorySearch
        action="/equipos"
        label={t.searchLabel}
        placeholder={t.searchPlaceholder}
        query={query.q}
        invalid={invalid}
      />
      {!result.ok ? (
        <LoadError code={result.code} />
      ) : result.data.total === 0 ? (
        query.q === '' ? (
          <EmptyState
            variant="showcase"
            icon={<ShieldIcon />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button asChild>
                <Link href={createHref}>{t.create}</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<SearchXIcon />}
            title={format(messages.directory.noResultsTitle, { query: query.q })}
            description={messages.directory.noResultsDescription}
          />
        )
      ) : (
        <>
          <p className="text-sm text-text-muted" aria-live="polite">
            {plural(t.count, result.data.total)}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.data.items.map((team) => (
              <li key={team.slug}>
                <TeamCard
                  team={team}
                  href={`/equipos/${team.slug}`}
                  detail={plural(t.members, team.memberCount)}
                />
              </li>
            ))}
          </ul>
          <DirectoryPagination
            base="/equipos"
            query={query.q}
            page={result.data.page}
            pageSize={result.data.pageSize}
            total={result.data.total}
          />
        </>
      )}
    </PageContainer>
  );
}
