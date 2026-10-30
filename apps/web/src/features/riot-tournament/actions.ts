'use server';

import {
  ConnectRiotResponseSchema,
  GenerateCodeRequestSchema,
  type ConnectRiotResponse,
  type GenerateCodeRequest,
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

export async function connectRiot(
  tournamentId: string,
): Promise<ActionResult<ConnectRiotResponse>> {
  if (!Uuid.safeParse(tournamentId).success) return invalid;
  const result = await apiRequest(`/admin/riot/tournaments/${tournamentId}/connect`, {
    method: 'POST',
    schema: ConnectRiotResponseSchema,
  });
  revalidatePath(`/admin/torneos/${tournamentId}/riot`);
  return toActionResult(result);
}

export async function generateRiotCode(
  tournamentId: string,
  matchId: string,
  input: GenerateCodeRequest = {},
): Promise<ActionResult<{ code: string }>> {
  if (!Uuid.safeParse(matchId).success) return invalid;
  const body = GenerateCodeRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest(`/admin/riot/matches/${matchId}/code`, {
    method: 'POST',
    body: body.data,
    schema: z.object({ code: z.string() }),
  });
  revalidatePath(`/admin/torneos/${tournamentId}/riot`);
  return toActionResult(result);
}
