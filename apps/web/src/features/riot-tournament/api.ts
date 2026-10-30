import 'server-only';

import { MatchCodesSchema, RiotIntegrationStatusSchema } from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

export const getRiotStatus = (tournamentId: string) =>
  apiRequest(`/admin/riot/tournaments/${tournamentId}/status`, {
    schema: RiotIntegrationStatusSchema,
  });

export const getAdminMatchCodes = (matchId: string) =>
  apiRequest(`/admin/riot/matches/${matchId}/codes`, { schema: MatchCodesSchema });

export const getMyMatchCodes = (matchId: string) =>
  apiRequest(`/matches/${matchId}/riot-codes`, { schema: MatchCodesSchema });
