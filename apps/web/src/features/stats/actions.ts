'use server';

import {
  AttachMatchDataRequestSchema,
  FollowRequestSchema,
  FollowStateSchema,
  RecalculateStatsResponseSchema,
  SaveAchievementRequestSchema,
  type FollowRequest,
  type FollowState,
  type RecalculateStatsResponse,
  type SaveAchievementRequest,
} from '@league/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { messages } from '@/config/i18n';
import { type ActionResult, toActionResult } from '@/lib/api/action-result';
import { errorMessage } from '@/lib/api/errors';
import { apiRequest } from '@/lib/api/server-client';

const invalid = {
  ok: false,
  code: 'validation_failed',
  message: errorMessage('validation_failed'),
} as const;
const Uuid = z.uuid();
const Key = z.string().regex(/^[a-z0-9_]{3,40}$/);

export async function follow(input: FollowRequest): Promise<ActionResult<FollowState>> {
  const body = FollowRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest('/me/follows', {
    method: 'POST',
    body: body.data,
    schema: FollowStateSchema,
  });
  revalidatePath('/app/siguiendo');
  return toActionResult(result);
}

export async function unfollow(input: FollowRequest): Promise<ActionResult<FollowState>> {
  const body = FollowRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest('/me/follows', {
    method: 'DELETE',
    body: body.data,
    schema: FollowStateSchema,
  });
  revalidatePath('/app/siguiendo');
  return toActionResult(result);
}

/** Staff pastes the Match-V5 JSON of a game. */
export async function attachMatchData(gameId: string, json: string): Promise<ActionResult> {
  if (!Uuid.safeParse(gameId).success) return invalid;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return {
      ok: false,
      code: 'invalid_json',
      message: messages.stats.admin.matchData.invalidJson,
    };
  }
  const body = AttachMatchDataRequestSchema.safeParse({ data });
  if (!body.success)
    return { ok: false, code: 'match_data_invalid', message: errorMessage('match_data_invalid') };
  const result = await apiRequest(`/admin/games/${gameId}/match-data`, {
    method: 'PUT',
    body: body.data,
  });
  revalidatePath('/admin/torneos', 'layout');
  return toActionResult(result);
}

export async function recalculateTournamentStats(
  tournamentId: string,
): Promise<ActionResult<RecalculateStatsResponse>> {
  if (!Uuid.safeParse(tournamentId).success) return invalid;
  return toActionResult(
    await apiRequest(`/admin/tournaments/${tournamentId}/stats/recalculate`, {
      method: 'POST',
      schema: RecalculateStatsResponseSchema,
    }),
  );
}

export async function saveAchievement(
  key: string,
  input: SaveAchievementRequest,
): Promise<ActionResult> {
  const body = SaveAchievementRequestSchema.safeParse(input);
  if (!Key.safeParse(key).success || !body.success) return invalid;
  const result = await apiRequest(`/admin/achievements/${key}`, { method: 'PUT', body: body.data });
  revalidatePath('/admin/logros');
  return toActionResult(result);
}
