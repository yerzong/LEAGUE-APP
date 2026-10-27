import { format, plural } from '@league/i18n';
import { Button, EmptyState, PageHeader } from '@league/ui';
import { SearchXIcon, UsersIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { brand } from '@/config/brand';
import { messages } from '@/config/i18n';
import { getSessionUser } from '@/features/auth/session';
import { LoadError } from '@/features/shell/load-error';
import { listPublicPlayers } from '@/features/site/api';
import { DirectoryPagination } from '@/features/site/components/directory-pagination';
import { DirectorySearch } from '@/features/site/components/directory-search';
import { PageContainer } from '@/features/site/components/page-container';
import { PlayerCard } from '@/features/site/components/player-card';
import { readDirectoryParams } from '@/features/site/directory-params';
import { pageMetadata } from '@/features/site/metadata';

const t = messages.playersPage;
const description = format(t.description, { brand: brand.name });

export const metadata: Metadata = pageMetadata({ title: t.title, description, path: '/jugadores' });

export default async function PlayersDirectoryPage({ searchParams }: PageProps<'/jugadores'>) {
  const { query, invalid } = readDirectoryParams(await searchParams);
  const [result, user] = await Promise.all([listPublicPlayers(query), getSessionUser()]);

  return (
    <PageContainer>
      <PageHeader
        title={t.title}
        description={description}
        actions={
          <Button asChild variant="outline">
            <Link href={user ? '/app/agente-libre' : '/register'}>
              {user ? t.freeAgent : t.create}
            </Link>
          </Button>
        }
      />
      <DirectorySearch
        action="/jugadores"
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
            icon={<UsersIcon />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={
              <Button asChild>
                <Link href="/register">{t.create}</Link>
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
            {result.data.items.map((player) => (
              <li key={player.username}>
                <PlayerCard player={player} />
              </li>
            ))}
          </ul>
          <DirectoryPagination
            base="/jugadores"
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
