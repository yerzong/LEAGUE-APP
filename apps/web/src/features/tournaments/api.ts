import 'server-only';

import {
  AuditEntrySchema,
  ExploreTournamentSchema,
  MyRegistrationSchema,
  PublicTournamentDetailSchema,
  PublicTournamentListSchema,
  RegistrationContextSchema,
  RegistrationCountsSchema,
  RegistrationSchema,
  TournamentDetailSchema,
  TournamentSummarySchema,
  TournamentTemplateSchema,
  type PublicTournamentFilter,
} from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

// Staff console (the API checks the staff role).
export const getAdminTournaments = () =>
  apiRequest('/admin/tournaments', { schema: TournamentSummarySchema.array() });
export const getAdminTournament = (id: string) =>
  apiRequest(`/admin/tournaments/${encodeURIComponent(id)}`, { schema: TournamentDetailSchema });
export const getRegistrations = (id: string) =>
  apiRequest(`/admin/tournaments/${encodeURIComponent(id)}/registrations`, {
    schema: RegistrationSchema.array(),
  });
export const getAuditTrail = (id: string) =>
  apiRequest(`/admin/tournaments/${encodeURIComponent(id)}/audit`, {
    schema: AuditEntrySchema.array(),
  });
export const getRegistrationCounts = (ids: readonly string[]) =>
  apiRequest(
    `/admin/registrations/counts?${new URLSearchParams({ ids: ids.join(',') }).toString()}`,
    {
      schema: RegistrationCountsSchema,
    },
  );
export const getTemplates = () =>
  apiRequest('/admin/tournament-templates', { schema: TournamentTemplateSchema.array() });
export const getTemplate = (id: string) =>
  apiRequest(`/admin/tournament-templates/${encodeURIComponent(id)}`, {
    schema: TournamentTemplateSchema,
  });

// Player portal.
export const exploreTournaments = () =>
  apiRequest('/tournaments/explore', { schema: ExploreTournamentSchema.array() });
export const getRegistrationContext = (slug: string) =>
  apiRequest(`/tournaments/by-slug/${encodeURIComponent(slug)}/registration`, {
    schema: RegistrationContextSchema,
  });
export const getMyRegistrations = () =>
  apiRequest('/registrations/mine', { schema: MyRegistrationSchema.array() });

// Public site: the same for every visitor, no session is read.
export const listPublicTournaments = (status: PublicTournamentFilter, page = 1, pageSize = 24) =>
  apiRequest(
    `/public/tournaments?${new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) }).toString()}`,
    { schema: PublicTournamentListSchema, auth: 'none' },
  );
export const getPublicTournament = (slug: string) =>
  apiRequest(`/public/tournaments/${encodeURIComponent(slug)}`, {
    schema: PublicTournamentDetailSchema,
    auth: 'none',
  });
