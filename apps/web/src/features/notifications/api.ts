import 'server-only';

import {
  AdminNotificationTypeDetailSchema,
  AdminNotificationTypeSchema,
  DeliveryHistorySchema,
  InboxSchema,
  NotificationPreferencesSchema,
  type DeliveryQuery,
} from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

export function getInbox(query: { before?: string | undefined; unread?: boolean; limit?: number }) {
  const params = new URLSearchParams();
  if (query.before) params.set('before', query.before);
  if (query.unread) params.set('unread', 'true');
  if (query.limit) params.set('limit', String(query.limit));
  const search = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest(`/notifications${search}`, { schema: InboxSchema });
}

export const getNotificationPreferences = () =>
  apiRequest('/me/notification-preferences', { schema: NotificationPreferencesSchema });

export const getNotificationTypes = () =>
  apiRequest('/admin/notifications/types', { schema: AdminNotificationTypeSchema.array() });

export const getNotificationType = (key: string) =>
  apiRequest(`/admin/notifications/types/${encodeURIComponent(key)}`, {
    schema: AdminNotificationTypeDetailSchema,
  });

export function getDeliveries(query: DeliveryQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === 'string') params.set(key, value);
  const search = params.size > 0 ? `?${params.toString()}` : '';
  return apiRequest(`/admin/notifications/deliveries${search}`, { schema: DeliveryHistorySchema });
}
