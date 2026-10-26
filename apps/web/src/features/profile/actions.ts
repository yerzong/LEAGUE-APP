'use server';

import {
  PrivacySettingsSchema,
  PrivateDataResponseSchema,
  ProfileResponseSchema,
  SocialLinksResponseSchema,
  UpdatePrivateDataRequestSchema,
  UpdateProfileRequestSchema,
  UpdateSocialLinksRequestSchema,
  type PrivacySettings,
  type PrivateDataResponse,
  type ProfileResponse,
  type UpdatePrivateDataInput,
  type UpdateProfileInput,
  type UpdateSocialLinksRequest,
} from '@league/contracts';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

import { type ActionResult, toActionResult } from '@/lib/api/action-result';
import { errorMessage } from '@/lib/api/errors';
import { apiRequest } from '@/lib/api/server-client';

/** Validates again on the server: the browser is not trusted. */
function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> | null {
  const result = schema.safeParse(input);
  return result.success ? result.data : null;
}

const invalid = {
  ok: false,
  code: 'validation_failed',
  message: errorMessage('validation_failed'),
} as const;

export async function saveProfile(
  input: UpdateProfileInput,
): Promise<ActionResult<ProfileResponse>> {
  const body = parse(UpdateProfileRequestSchema, input);
  if (!body) return invalid;
  const result = await apiRequest('/me/profile', {
    method: 'PUT',
    body,
    schema: ProfileResponseSchema,
  });
  revalidatePath('/app', 'layout');
  return toActionResult(result);
}

export async function uploadAvatar(form: FormData): Promise<ActionResult<ProfileResponse>> {
  const file = form.get('file');
  if (!(file instanceof File))
    return { ok: false, code: 'image_required', message: errorMessage('image_required') };
  const upload = new FormData();
  upload.append('file', file);
  const result = await apiRequest('/me/avatar', {
    method: 'POST',
    form: upload,
    schema: ProfileResponseSchema,
  });
  revalidatePath('/app', 'layout');
  return toActionResult(result);
}

export async function savePrivateData(
  input: UpdatePrivateDataInput,
): Promise<ActionResult<PrivateDataResponse>> {
  const body = parse(UpdatePrivateDataRequestSchema, input);
  if (!body) return invalid;
  return toActionResult(
    await apiRequest('/me/private-data', {
      method: 'PUT',
      body,
      schema: PrivateDataResponseSchema,
    }),
  );
}

export async function savePrivacy(input: PrivacySettings): Promise<ActionResult<PrivacySettings>> {
  const body = parse(PrivacySettingsSchema, input);
  if (!body) return invalid;
  return toActionResult(
    await apiRequest('/me/privacy', { method: 'PUT', body, schema: PrivacySettingsSchema }),
  );
}

export async function saveSocialLinks(
  input: UpdateSocialLinksRequest,
): Promise<ActionResult<UpdateSocialLinksRequest>> {
  const body = parse(UpdateSocialLinksRequestSchema, input);
  if (!body) return invalid;
  return toActionResult(
    await apiRequest('/me/social-links', {
      method: 'PUT',
      body,
      schema: SocialLinksResponseSchema,
    }),
  );
}
