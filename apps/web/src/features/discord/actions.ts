'use server';

import {
  DiscordConfigSchema,
  SaveDiscordGuildRequestSchema,
  SetDiscordChannelRequestSchema,
  type DiscordConfig,
  type SaveDiscordGuildRequest,
  type SetDiscordChannelRequest,
} from '@league/contracts';
import { revalidatePath } from 'next/cache';

import { type ActionResult, toActionResult } from '@/lib/api/action-result';
import { errorMessage } from '@/lib/api/errors';
import { apiRequest } from '@/lib/api/server-client';

const invalid = {
  ok: false,
  code: 'validation_failed',
  message: errorMessage('validation_failed'),
} as const;

export async function saveDiscordGuild(
  input: SaveDiscordGuildRequest,
): Promise<ActionResult<DiscordConfig>> {
  const body = SaveDiscordGuildRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest('/admin/discord', {
    method: 'PUT',
    body: body.data,
    schema: DiscordConfigSchema,
  });
  revalidatePath('/admin/discord');
  return toActionResult(result);
}

export async function setDiscordChannel(
  input: SetDiscordChannelRequest,
): Promise<ActionResult<DiscordConfig>> {
  const body = SetDiscordChannelRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest('/admin/discord/channel', {
    method: 'PUT',
    body: body.data,
    schema: DiscordConfigSchema,
  });
  revalidatePath('/admin/discord');
  return toActionResult(result);
}
