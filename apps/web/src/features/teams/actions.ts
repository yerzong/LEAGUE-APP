'use server';

import {
  ChangeMemberRoleRequestSchema,
  CreateInvitationRequestSchema,
  CreateJoinRequestSchema,
  CreateTeamRequestSchema,
  DecideJoinRequestSchema,
  DissolveTeamRequestSchema,
  FreeAgentResponseSchema,
  TeamDetailSchema,
  TeamInvitationSchema,
  TeamSummarySchema,
  TransferCaptaincyRequestSchema,
  UpdateFreeAgentRequestSchema,
  UpdateTeamRequestSchema,
  UserSearchQuerySchema,
  UserSearchResultSchema,
  type ChangeMemberRoleRequest,
  type CreateInvitationRequest,
  type CreateTeamInput,
  type DecideJoinRequest,
  type FreeAgentResponse,
  type TeamDetail,
  type TeamInvitation,
  type TeamSummary,
  type UpdateFreeAgentInput,
  type UserSearchResult,
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
const Code = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/** The team pages and the portal home show teams and invitations. */
function refresh(slug?: string) {
  revalidatePath('/app', 'layout');
  if (slug) revalidatePath(`/equipos/${slug}`);
}

export async function createTeam(input: CreateTeamInput): Promise<ActionResult<TeamDetail>> {
  const body = CreateTeamRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest('/teams', {
    method: 'POST',
    body: body.data,
    schema: TeamDetailSchema,
  });
  refresh();
  return toActionResult(result);
}

export async function updateTeam(
  teamId: string,
  input: CreateTeamInput,
): Promise<ActionResult<TeamDetail>> {
  const body = UpdateTeamRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}`, {
    method: 'PUT',
    body: body.data,
    schema: TeamDetailSchema,
  });
  if (result.ok) refresh(result.data.slug);
  return toActionResult(result);
}

export async function uploadTeamLogo(
  teamId: string,
  form: FormData,
): Promise<ActionResult<TeamDetail>> {
  const file = form.get('file');
  if (!(file instanceof File) || !Uuid.safeParse(teamId).success) return invalid;
  const upload = new FormData();
  upload.append('file', file);
  const result = await apiRequest(`/teams/${teamId}/logo`, {
    method: 'POST',
    form: upload,
    schema: TeamDetailSchema,
  });
  if (result.ok) refresh(result.data.slug);
  return toActionResult(result);
}

export async function dissolveTeam(teamId: string, reason: string): Promise<ActionResult> {
  const body = DissolveTeamRequestSchema.safeParse({ reason });
  if (!body.success || !Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/dissolve`, { method: 'POST', body: body.data });
  refresh();
  return toActionResult(result);
}

export async function searchUsers(query: string): Promise<ActionResult<UserSearchResult[]>> {
  const q = UserSearchQuerySchema.safeParse({ q: query });
  if (!q.success) return { ok: true, data: [] };
  return toActionResult(
    await apiRequest(`/users/search?${new URLSearchParams({ q: q.data.q }).toString()}`, {
      schema: UserSearchResultSchema.array(),
    }),
  );
}

export async function inviteToTeam(
  teamId: string,
  input: CreateInvitationRequest,
): Promise<ActionResult<TeamInvitation>> {
  const body = CreateInvitationRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/invitations`, {
    method: 'POST',
    body: body.data,
    schema: TeamInvitationSchema,
  });
  refresh();
  return toActionResult(result);
}

export async function revokeInvitation(
  teamId: string,
  invitationId: string,
): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success || !Uuid.safeParse(invitationId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/invitations/${invitationId}`, {
    method: 'DELETE',
  });
  refresh();
  return toActionResult(result);
}

export async function acceptInvitation(
  ref: { invitationId: string } | { code: string },
): Promise<ActionResult<TeamSummary>> {
  const path =
    'code' in ref
      ? Code.safeParse(ref.code).success
        ? `/invitations/code/${ref.code}/accept`
        : null
      : Uuid.safeParse(ref.invitationId).success
        ? `/invitations/${ref.invitationId}/accept`
        : null;
  if (!path) return invalid;
  const result = await apiRequest(path, { method: 'POST', schema: TeamSummarySchema });
  if (result.ok) refresh(result.data.slug);
  return toActionResult(result);
}

export async function declineInvitation(invitationId: string): Promise<ActionResult> {
  if (!Uuid.safeParse(invitationId).success) return invalid;
  const result = await apiRequest(`/invitations/${invitationId}/decline`, { method: 'POST' });
  refresh();
  return toActionResult(result);
}

export async function requestToJoin(
  teamId: string,
  message: string,
): Promise<ActionResult<{ id: string }>> {
  const body = CreateJoinRequestSchema.safeParse({ message });
  if (!body.success || !Uuid.safeParse(teamId).success) return invalid;
  return toActionResult(
    await apiRequest(`/teams/${teamId}/join-requests`, {
      method: 'POST',
      body: body.data,
      schema: z.object({ id: z.uuid() }),
    }),
  );
}

export async function decideJoinRequest(
  teamId: string,
  requestId: string,
  input: DecideJoinRequest,
): Promise<ActionResult<TeamDetail>> {
  const body = DecideJoinRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(teamId).success || !Uuid.safeParse(requestId).success)
    return invalid;
  const result = await apiRequest(`/teams/${teamId}/join-requests/${requestId}/decision`, {
    method: 'POST',
    body: body.data,
    schema: TeamDetailSchema,
  });
  if (result.ok) refresh(result.data.slug);
  return toActionResult(result);
}

export async function changeMember(
  teamId: string,
  userId: string,
  input: ChangeMemberRoleRequest,
): Promise<ActionResult<TeamDetail>> {
  const body = ChangeMemberRoleRequestSchema.safeParse(input);
  if (!body.success || !Uuid.safeParse(teamId).success || !Uuid.safeParse(userId).success)
    return invalid;
  const result = await apiRequest(`/teams/${teamId}/members/${userId}`, {
    method: 'PATCH',
    body: body.data,
    schema: TeamDetailSchema,
  });
  if (result.ok) refresh(result.data.slug);
  return toActionResult(result);
}

export async function removeMember(teamId: string, userId: string): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success || !Uuid.safeParse(userId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
  refresh();
  return toActionResult(result);
}

export async function leaveTeam(teamId: string): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/leave`, { method: 'POST' });
  refresh();
  return toActionResult(result);
}

export async function requestCaptaincyTransfer(
  teamId: string,
  toUserId: string,
): Promise<ActionResult> {
  const body = TransferCaptaincyRequestSchema.safeParse({ toUserId });
  if (!body.success || !Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/captaincy-transfer`, {
    method: 'POST',
    body: body.data,
  });
  refresh();
  return toActionResult(result);
}

export async function respondCaptaincyTransfer(
  teamId: string,
  decision: 'accept' | 'decline',
): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/captaincy-transfer/${decision}`, {
    method: 'POST',
  });
  refresh();
  return toActionResult(result);
}

export async function cancelCaptaincyTransfer(teamId: string): Promise<ActionResult> {
  if (!Uuid.safeParse(teamId).success) return invalid;
  const result = await apiRequest(`/teams/${teamId}/captaincy-transfer`, { method: 'DELETE' });
  refresh();
  return toActionResult(result);
}

export async function saveFreeAgent(
  input: UpdateFreeAgentInput,
): Promise<ActionResult<FreeAgentResponse>> {
  const body = UpdateFreeAgentRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  return toActionResult(
    await apiRequest('/me/free-agent', {
      method: 'PUT',
      body: body.data,
      schema: FreeAgentResponseSchema,
    }),
  );
}
