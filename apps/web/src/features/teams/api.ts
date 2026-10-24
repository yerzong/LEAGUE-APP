import 'server-only';

import {
  FreeAgentResponseSchema,
  MyTeamSchema,
  PublicPlayerSchema,
  PublicTeamSchema,
  ReceivedInvitationSchema,
  TeamDetailSchema,
} from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

export const getMyTeams = () => apiRequest('/teams/mine', { schema: MyTeamSchema.array() });
export const getTeamBySlug = (slug: string) =>
  apiRequest(`/teams/by-slug/${encodeURIComponent(slug)}`, { schema: TeamDetailSchema });
export const getMyInvitations = () =>
  apiRequest('/invitations/mine', { schema: ReceivedInvitationSchema.array() });
export const getInvitationByCode = (code: string) =>
  apiRequest(`/invitations/code/${encodeURIComponent(code)}`, { schema: ReceivedInvitationSchema });
export const getMyFreeAgent = () =>
  apiRequest('/me/free-agent', { schema: FreeAgentResponseSchema });

export const getPublicTeam = (slug: string) =>
  apiRequest(`/public/teams/${encodeURIComponent(slug)}`, {
    schema: PublicTeamSchema,
    auth: 'optional',
  });
export const getPublicPlayer = (username: string) =>
  apiRequest(`/public/players/${encodeURIComponent(username)}`, {
    schema: PublicPlayerSchema,
    auth: 'optional',
  });
