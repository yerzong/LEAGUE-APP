import 'server-only';

import {
  type DirectoryQuery,
  PublicPlayerListSchema,
  PublicTeamListSchema,
} from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

function directoryPath(base: string, { q, page, pageSize }: DirectoryQuery): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q !== '') params.set('q', q);
  return `${base}?${params.toString()}`;
}

// Directories are the same for every visitor: no session is read.
export const listPublicTeams = (query: DirectoryQuery) =>
  apiRequest(directoryPath('/public/teams', query), { schema: PublicTeamListSchema, auth: 'none' });
export const listPublicPlayers = (query: DirectoryQuery) =>
  apiRequest(directoryPath('/public/players', query), {
    schema: PublicPlayerListSchema,
    auth: 'none',
  });
