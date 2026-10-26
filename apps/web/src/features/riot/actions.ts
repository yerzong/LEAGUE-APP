'use server';

import {
  RiotAccountResponseSchema,
  RiotVerificationResponseSchema,
  StartRiotVerificationRequestSchema,
  UnlinkRiotAccountRequestSchema,
  type RiotAccountResponse,
  type RiotVerificationResponse,
  type StartRiotVerificationRequest,
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

export async function startRiotVerification(
  input: StartRiotVerificationRequest,
): Promise<ActionResult<RiotVerificationResponse>> {
  const body = StartRiotVerificationRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  return toActionResult(
    await apiRequest('/me/riot-account/verifications', {
      method: 'POST',
      body: body.data,
      schema: RiotVerificationResponseSchema,
    }),
  );
}

export async function confirmRiotVerification(
  attemptId: string,
): Promise<ActionResult<RiotAccountResponse>> {
  const id = z.uuid().safeParse(attemptId);
  if (!id.success) return invalid;
  const result = await apiRequest(`/me/riot-account/verifications/${id.data}/confirm`, {
    method: 'POST',
    schema: RiotAccountResponseSchema,
  });
  revalidatePath('/app', 'layout');
  return toActionResult(result);
}

export async function unlinkRiotAccount(reason: string): Promise<ActionResult> {
  const body = UnlinkRiotAccountRequestSchema.safeParse({ reason });
  if (!body.success) return invalid;
  const result = await apiRequest('/me/riot-account', { method: 'DELETE', body: body.data });
  revalidatePath('/app', 'layout');
  return toActionResult(result);
}
