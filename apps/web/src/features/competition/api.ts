import 'server-only';

import { MatchDetailSchema, MyMatchSchema, TournamentBoardSchema } from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

export const getAdminBoard = (tournamentId: string) =>
  apiRequest(`/admin/tournaments/${encodeURIComponent(tournamentId)}/board`, {
    schema: TournamentBoardSchema,
  });
/** Signed-in view: the parties and staff also get reports, disputes and actions. */
export const getMatch = (matchId: string) =>
  apiRequest(`/matches/${encodeURIComponent(matchId)}`, { schema: MatchDetailSchema });
export const getMyMatches = () => apiRequest('/matches/mine', { schema: MyMatchSchema.array() });

// Public site: the same for every visitor, no session is read.
export const getPublicBoard = (slug: string) =>
  apiRequest(`/public/tournaments/${encodeURIComponent(slug)}/board`, {
    schema: TournamentBoardSchema,
    auth: 'none',
  });
export const getPublicMatch = (matchId: string) =>
  apiRequest(`/public/matches/${encodeURIComponent(matchId)}`, {
    schema: MatchDetailSchema,
    auth: 'none',
  });
