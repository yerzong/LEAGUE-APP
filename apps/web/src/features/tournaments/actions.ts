'use server';

import {
  CreateTemplateRequestSchema,
  CreateTournamentRequestSchema,
  DecideRegistrationRequestSchema,
  MyRegistrationSchema,
  RegisterRequestSchema,
  RegistrationCheckRequestSchema,
  RegistrationCheckSchema,
  RegistrationSchema,
  RulebookDraftRequestSchema,
  SeedingRequestSchema,
  TournamentActionSchema,
  TournamentDetailSchema,
  TournamentTemplateSchema,
  UpdateTournamentRequestSchema,
  type DecideRegistrationRequest,
  type MyRegistration,
  type RegisterRequest,
  type Registration,
  type RegistrationCheck,
  type RegistrationCheckRequest,
  type RulebookDraftRequest,
  type SeedingRequest,
  type TournamentAction,
  type TournamentConfigInput,
  type TournamentDetail,
  type TournamentTemplate,
} from '@league/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, toActionResult } from '@/lib/api/action-result';
import { errorMessage } from '@/lib/api/errors';
import { apiRequest, type ApiResult } from '@/lib/api/server-client';

const invalid = {
  ok: false,
  code: 'validation_failed',
  message: errorMessage('validation_failed'),
} as const;
const Uuid = z.uuid();

/** Like ActionResult, with the error details the forms need (sections, issues, failures). */
export type DetailedResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; details: Record<string, unknown> };

function detailed<T>(result: ApiResult<T>): DetailedResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : {
        ok: false,
        code: result.code,
        message: errorMessage(result.code),
        details: result.details ?? {},
      };
}

/** Admin, portal and public pages show tournaments. */
function refresh(tournament?: { id: string; slug: string }) {
  revalidatePath('/admin/torneos', 'layout');
  revalidatePath('/app/torneos', 'layout');
  revalidatePath('/torneos', 'layout');
  if (tournament) revalidatePath(`/torneos/${tournament.slug}`);
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function createTournament(
  config: TournamentConfigInput,
  templateId: string | null,
): Promise<DetailedResult<TournamentDetail>> {
  const body = CreateTournamentRequestSchema.safeParse({ config, templateId });
  if (!body.success) return { ...invalid, details: {} };
  const result = await apiRequest('/admin/tournaments', {
    method: 'POST',
    body: body.data,
    schema: TournamentDetailSchema,
  });
  refresh();
  return detailed(result);
}

export async function updateTournament(
  id: string,
  config: TournamentConfigInput,
  confirm: boolean,
  reason: string | null,
): Promise<DetailedResult<TournamentDetail>> {
  const body = UpdateTournamentRequestSchema.safeParse({ config, confirm, reason });
  if (!body.success || !Uuid.safeParse(id).success) return { ...invalid, details: {} };
  const result = await apiRequest(`/admin/tournaments/${id}`, {
    method: 'PUT',
    body: body.data,
    schema: TournamentDetailSchema,
  });
  if (result.ok) refresh(result.data);
  return detailed(result);
}

export async function uploadTournamentCover(
  id: string,
  form: FormData,
): Promise<ActionResult<TournamentDetail>> {
  if (!Uuid.safeParse(id).success) return invalid;
  const result = await apiRequest(`/admin/tournaments/${id}/cover`, {
    method: 'POST',
    form,
    schema: TournamentDetailSchema,
  });
  if (result.ok) refresh(result.data);
  return toActionResult(result);
}

export async function runTournamentAction(
  id: string,
  action: TournamentAction,
  reason: string | null,
): Promise<DetailedResult<TournamentDetail>> {
  if (!Uuid.safeParse(id).success || !TournamentActionSchema.safeParse(action).success)
    return { ...invalid, details: {} };
  const result = await apiRequest(`/admin/tournaments/${id}/actions/${action}`, {
    method: 'POST',
    body: { reason },
    schema: TournamentDetailSchema,
  });
  if (result.ok) refresh(result.data);
  return detailed(result);
}

export async function saveRulebookDraft(
  id: string,
  input: RulebookDraftRequest,
): Promise<ActionResult<TournamentDetail>> {
  const body = RulebookDraftRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(id).success) return invalid;
  const result = await apiRequest(`/admin/tournaments/${id}/rulebook`, {
    method: 'PUT',
    body: body.data,
    schema: TournamentDetailSchema,
  });
  if (result.ok) refresh(result.data);
  return toActionResult(result);
}

export async function publishRulebookVersion(id: string): Promise<ActionResult<TournamentDetail>> {
  if (!Uuid.safeParse(id).success) return invalid;
  const result = await apiRequest(`/admin/tournaments/${id}/rulebook/publish`, {
    method: 'POST',
    schema: TournamentDetailSchema,
  });
  if (result.ok) refresh(result.data);
  return toActionResult(result);
}

export async function createTemplate(
  name: string,
  config: TournamentConfigInput,
): Promise<ActionResult<TournamentTemplate>> {
  const body = CreateTemplateRequestSchema.safeParse({ name, config });
  if (!body.success) return invalid;
  const result = await apiRequest('/admin/tournament-templates', {
    method: 'POST',
    body: body.data,
    schema: TournamentTemplateSchema,
  });
  revalidatePath('/admin/plantillas');
  return toActionResult(result);
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  if (!Uuid.safeParse(id).success) return invalid;
  const result = await apiRequest(`/admin/tournament-templates/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/plantillas');
  return toActionResult(result);
}

export async function decideRegistration(
  registrationId: string,
  input: DecideRegistrationRequest,
): Promise<DetailedResult<Registration>> {
  const body = DecideRegistrationRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(registrationId).success) return { ...invalid, details: {} };
  const result = await apiRequest(`/admin/registrations/${registrationId}/decision`, {
    method: 'POST',
    body: body.data,
    schema: RegistrationSchema,
  });
  refresh();
  return detailed(result);
}

export async function seedRegistrations(
  tournamentId: string,
  input: SeedingRequest,
): Promise<ActionResult<Registration[]>> {
  const body = SeedingRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(tournamentId).success) return invalid;
  const result = await apiRequest(`/admin/tournaments/${tournamentId}/seeding`, {
    method: 'POST',
    body: body.data,
    schema: RegistrationSchema.array(),
  });
  refresh();
  return toActionResult(result);
}

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

export async function checkRegistration(
  tournamentId: string,
  input: RegistrationCheckRequest,
): Promise<ActionResult<RegistrationCheck>> {
  const body = RegistrationCheckRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(tournamentId).success) return invalid;
  return toActionResult(
    await apiRequest(`/tournaments/${tournamentId}/registrations/check`, {
      method: 'POST',
      body: body.data,
      schema: RegistrationCheckSchema,
    }),
  );
}

export async function register(
  tournamentId: string,
  input: RegisterRequest,
): Promise<DetailedResult<MyRegistration>> {
  const body = RegisterRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(tournamentId).success) return { ...invalid, details: {} };
  const result = await apiRequest(`/tournaments/${tournamentId}/registrations`, {
    method: 'POST',
    body: body.data,
    schema: MyRegistrationSchema,
  });
  refresh();
  return detailed(result);
}

export async function withdrawRegistration(
  registrationId: string,
): Promise<ActionResult<MyRegistration>> {
  if (!Uuid.safeParse(registrationId).success) return invalid;
  const result = await apiRequest(`/registrations/${registrationId}/withdraw`, {
    method: 'POST',
    schema: MyRegistrationSchema,
  });
  refresh();
  return toActionResult(result);
}
