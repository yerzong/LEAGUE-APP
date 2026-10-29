import 'server-only';

import {
  AdminAchievementListSchema,
  FollowListSchema,
  HeadToHeadSchema,
  MatchDataStatusSchema,
  MatchStatsSchema,
  PlayerStatsSchema,
  TeamStatsSchema,
  TournamentStatsSchema,
} from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

const enc = encodeURIComponent;

// Public pages: a signed-in viewer also learns whether they follow.
export const getPlayerStats = (username: string) =>
  apiRequest(`/public/players/${enc(username)}/stats`, {
    schema: PlayerStatsSchema,
    auth: 'optional',
  });
export const getHeadToHead = (a: string, b: string) =>
  apiRequest(`/public/players/${enc(a)}/vs/${enc(b)}`, { schema: HeadToHeadSchema, auth: 'none' });
export const getTeamStats = (slug: string) =>
  apiRequest(`/public/teams/${enc(slug)}/stats`, { schema: TeamStatsSchema, auth: 'optional' });
export const getTournamentStats = (slug: string) =>
  apiRequest(`/public/tournaments/${enc(slug)}/stats`, {
    schema: TournamentStatsSchema,
    auth: 'optional',
  });
export const getMatchStats = (matchId: string) =>
  apiRequest(`/public/matches/${enc(matchId)}/stats`, { schema: MatchStatsSchema, auth: 'none' });

export const listMyFollows = () => apiRequest('/me/follows', { schema: FollowListSchema });

// Staff
export const getMatchDataStatus = (matchId: string) =>
  apiRequest(`/admin/matches/${enc(matchId)}/match-data`, { schema: MatchDataStatusSchema });
export const listAchievements = () =>
  apiRequest('/admin/achievements', { schema: AdminAchievementListSchema });
