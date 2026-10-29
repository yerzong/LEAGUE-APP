'use server';

import {
  AdminNotificationTypeDetailSchema,
  InboxSchema,
  NotificationChannelSchema,
  NotificationPreferencesSchema,
  PreviewTemplateRequestSchema,
  SaveTemplateRequestSchema,
  TemplatePreviewSchema,
  UnreadCountSchema,
  UpdatePreferencesRequestSchema,
  UpdateRuleRequestSchema,
  type AdminNotificationTypeDetail,
  type Inbox,
  type NotificationChannel,
  type NotificationPreferences,
  type PreviewTemplateRequest,
  type SaveTemplateRequest,
  type TemplatePreview,
  type UnreadCount,
  type UpdatePreferencesRequest,
  type UpdateRuleRequest,
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
const TypeKey = z
  .string()
  .regex(/^[a-z_]+(\.[a-z_]+)+$/)
  .max(80);

/** The bell: the latest notifications and the unread count. */
export async function loadBell(): Promise<ActionResult<Inbox>> {
  return toActionResult(await apiRequest('/notifications?limit=8', { schema: InboxSchema }));
}

export async function markNotificationRead(id: string): Promise<ActionResult<UnreadCount>> {
  if (!Uuid.safeParse(id).success) return invalid;
  const result = await apiRequest(`/notifications/${id}/read`, {
    method: 'POST',
    schema: UnreadCountSchema,
  });
  revalidatePath('/app/notificaciones');
  return toActionResult(result);
}

export async function markAllNotificationsRead(): Promise<ActionResult<UnreadCount>> {
  const result = await apiRequest('/notifications/read-all', {
    method: 'POST',
    schema: UnreadCountSchema,
  });
  revalidatePath('/app/notificaciones');
  return toActionResult(result);
}

export async function saveNotificationPreferences(
  input: UpdatePreferencesRequest,
): Promise<ActionResult<NotificationPreferences>> {
  const body = UpdatePreferencesRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  const result = await apiRequest('/me/notification-preferences', {
    method: 'PUT',
    body: body.data,
    schema: NotificationPreferencesSchema,
  });
  revalidatePath('/app/ajustes/notificaciones');
  return toActionResult(result);
}

function refreshAdmin() {
  revalidatePath('/admin/notificaciones', 'layout');
}

export async function saveNotificationRule(
  key: string,
  input: UpdateRuleRequest,
): Promise<ActionResult<AdminNotificationTypeDetail>> {
  const body = UpdateRuleRequestSchema.safeParse(input);
  if (!TypeKey.safeParse(key).success || !body.success) return invalid;
  const result = await apiRequest(`/admin/notifications/types/${key}/rule`, {
    method: 'PUT',
    body: body.data,
    schema: AdminNotificationTypeDetailSchema,
  });
  refreshAdmin();
  return toActionResult(result);
}

export async function saveNotificationTemplate(
  key: string,
  channel: NotificationChannel,
  input: SaveTemplateRequest,
): Promise<ActionResult<AdminNotificationTypeDetail>> {
  const body = SaveTemplateRequestSchema.safeParse(input);
  if (!TypeKey.safeParse(key).success || !NotificationChannelSchema.safeParse(channel).success)
    return invalid;
  if (!body.success) return invalid;
  const result = await apiRequest(`/admin/notifications/types/${key}/templates/${channel}`, {
    method: 'PUT',
    body: body.data,
    schema: AdminNotificationTypeDetailSchema,
  });
  refreshAdmin();
  return toActionResult(result);
}

export async function resetNotificationTemplate(
  key: string,
  channel: NotificationChannel,
): Promise<ActionResult<AdminNotificationTypeDetail>> {
  if (!TypeKey.safeParse(key).success || !NotificationChannelSchema.safeParse(channel).success)
    return invalid;
  const result = await apiRequest(`/admin/notifications/types/${key}/templates/${channel}`, {
    method: 'DELETE',
    schema: AdminNotificationTypeDetailSchema,
  });
  refreshAdmin();
  return toActionResult(result);
}

export async function previewNotificationTemplate(
  input: PreviewTemplateRequest,
): Promise<ActionResult<TemplatePreview>> {
  const body = PreviewTemplateRequestSchema.safeParse(input);
  if (!body.success) return invalid;
  return toActionResult(
    await apiRequest('/admin/notifications/templates/preview', {
      method: 'POST',
      body: body.data,
      schema: TemplatePreviewSchema,
    }),
  );
}
