'use server';

import {
  DecideRescheduleRequestSchema,
  DisputeEvidenceRequestSchema,
  MatchActionSchema,
  MatchDetailSchema,
  OpenDisputeRequestSchema,
  ReportResultRequestSchema,
  RescheduleRequestSchema,
  ResolveDisputeRequestSchema,
  RespondRescheduleRequestSchema,
  SetScheduleRequestSchema,
  StaffForfeitRequestSchema,
  StaffResultRequestSchema,
  type DecideRescheduleRequest,
  type DisputeEvidenceRequest,
  type MatchAction,
  type MatchDetail,
  type OpenDisputeRequest,
  type ReportResultRequest,
  type RescheduleRequest,
  type ResolveDisputeRequest,
  type RespondRescheduleRequest,
  type SetScheduleRequest,
  type StaffForfeitRequest,
  type StaffResultRequest,
} from '@league/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, toActionResult } from '@/lib/api/action-result';
import { errorMessage } from '@/lib/api/errors';
import { apiRequest } from '@/lib/api/server-client';

const invalid = {
  ok: false,
  code: 'validation_failed',
  message: errorMessage('validation_failed'),
} as const;
const Uuid = z.uuid();

/** Boards and match pages of every zone show the competition. */
function refresh() {
  revalidatePath('/admin/torneos', 'layout');
  revalidatePath('/app/partidas', 'layout');
  revalidatePath('/torneos', 'layout');
}

async function post<T extends z.ZodType>(
  path: string,
  schema: z.ZodType,
  input: unknown,
  response: T,
): Promise<ActionResult<z.infer<T>>> {
  const body = schema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest(path, { method: 'POST', body: body.data, schema: response });
  refresh();
  return toActionResult(result) as ActionResult<z.infer<T>>;
}

const matchPath = (id: string, suffix: string) =>
  Uuid.safeParse(id).success ? `/matches/${id}/${suffix}` : null;

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function generateFixtures(tournamentId: string): Promise<ActionResult> {
  if (!Uuid.safeParse(tournamentId).success) return invalid;
  const result = await apiRequest(`/admin/tournaments/${tournamentId}/fixtures`, {
    method: 'POST',
  });
  refresh();
  return toActionResult(result);
}

export async function autoSchedule(
  tournamentId: string,
): Promise<ActionResult<{ scheduled: number }>> {
  if (!Uuid.safeParse(tournamentId).success) return invalid;
  const result = await apiRequest(`/admin/tournaments/${tournamentId}/schedule`, {
    method: 'POST',
    schema: z.object({ scheduled: z.number().int() }),
  });
  refresh();
  return toActionResult(result);
}

export async function setMatchTime(
  matchId: string,
  input: SetScheduleRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(matchId).success) return invalid;
  return post(
    `/admin/matches/${matchId}/schedule`,
    SetScheduleRequestSchema,
    input,
    MatchDetailSchema,
  );
}

export async function runMatchAction(
  matchId: string,
  action: MatchAction,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(matchId).success || !MatchActionSchema.safeParse(action).success)
    return invalid;
  const result = await apiRequest(`/admin/matches/${matchId}/actions/${action}`, {
    method: 'POST',
    schema: MatchDetailSchema,
  });
  refresh();
  return toActionResult(result);
}

export async function staffResult(
  matchId: string,
  input: StaffResultRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(matchId).success) return invalid;
  return post(
    `/admin/matches/${matchId}/result`,
    StaffResultRequestSchema,
    input,
    MatchDetailSchema,
  );
}

export async function staffForfeit(
  matchId: string,
  input: StaffForfeitRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(matchId).success) return invalid;
  return post(
    `/admin/matches/${matchId}/forfeit`,
    StaffForfeitRequestSchema,
    input,
    MatchDetailSchema,
  );
}

export async function resolveDispute(
  disputeId: string,
  input: ResolveDisputeRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(disputeId).success) return invalid;
  return post(
    `/admin/disputes/${disputeId}/resolve`,
    ResolveDisputeRequestSchema,
    input,
    MatchDetailSchema,
  );
}

export async function decideReschedule(
  requestId: string,
  input: DecideRescheduleRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(requestId).success) return invalid;
  return post(
    `/admin/reschedules/${requestId}/decision`,
    DecideRescheduleRequestSchema,
    input,
    MatchDetailSchema,
  );
}

// ---------------------------------------------------------------------------
// Captains
// ---------------------------------------------------------------------------

export async function checkIn(matchId: string): Promise<ActionResult<MatchDetail>> {
  const path = matchPath(matchId, 'checkin');
  if (!path) return invalid;
  const result = await apiRequest(path, { method: 'POST', schema: MatchDetailSchema });
  refresh();
  return toActionResult(result);
}

export async function reportResult(
  matchId: string,
  input: ReportResultRequest,
): Promise<ActionResult<MatchDetail>> {
  const path = matchPath(matchId, 'report');
  if (!path) return invalid;
  return post(path, ReportResultRequestSchema, input, MatchDetailSchema);
}

export async function uploadEvidence(
  matchId: string,
  form: FormData,
): Promise<ActionResult<{ path: string }>> {
  const path = matchPath(matchId, 'evidence');
  if (!path) return invalid;
  return toActionResult(
    await apiRequest(path, { method: 'POST', form, schema: z.object({ path: z.string() }) }),
  );
}

export async function openDispute(
  matchId: string,
  input: OpenDisputeRequest,
): Promise<ActionResult<MatchDetail>> {
  const path = matchPath(matchId, 'disputes');
  if (!path) return invalid;
  return post(path, OpenDisputeRequestSchema, input, MatchDetailSchema);
}

export async function addDisputeEvidence(
  disputeId: string,
  input: DisputeEvidenceRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(disputeId).success) return invalid;
  return post(
    `/disputes/${disputeId}/evidence`,
    DisputeEvidenceRequestSchema,
    input,
    MatchDetailSchema,
  );
}

export async function requestReschedule(
  matchId: string,
  input: RescheduleRequest,
): Promise<ActionResult<MatchDetail>> {
  const path = matchPath(matchId, 'reschedules');
  if (!path) return invalid;
  return post(path, RescheduleRequestSchema, input, MatchDetailSchema);
}

export async function respondReschedule(
  requestId: string,
  input: RespondRescheduleRequest,
): Promise<ActionResult<MatchDetail>> {
  if (!Uuid.safeParse(requestId).success) return invalid;
  return post(
    `/reschedules/${requestId}/response`,
    RespondRescheduleRequestSchema,
    input,
    MatchDetailSchema,
  );
}
