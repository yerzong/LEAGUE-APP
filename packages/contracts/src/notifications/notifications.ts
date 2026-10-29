import { z } from 'zod';

import { NotificationChannelSchema } from '../tournaments/config.js';

// Module 06: notification inbox, preferences and the admin console (docs/15).
const IsoDateTime = z.iso.datetime({ offset: true });

export const NotificationCategorySchema = z.enum([
  'tournaments',
  'matches',
  'team',
  'staff',
  'announcements',
  'marketing',
]);
export const DeliveryStatusSchema = z.enum(['queued', 'sent', 'delivered', 'failed']);

export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export const NOTIFICATION_CHANNELS = NotificationChannelSchema.options;

export const DELIVERY_STATUSES = DeliveryStatusSchema.options;

const TypeKeySchema = z
  .string()
  .regex(/^[a-z_]+(\.[a-z_]+)+$/)
  .max(80);

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------
export const InboxItemSchema = z.object({
  id: z.uuid(),
  typeKey: TypeKeySchema,
  category: NotificationCategorySchema,
  title: z.string(),
  body: z.string(),
  /** Path inside the platform (`/app/…`, `/admin/…`, `/torneos/…`). */
  link: z.string().startsWith('/').nullable(),
  readAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type InboxItem = z.infer<typeof InboxItemSchema>;

export const InboxSchema = z.object({
  items: z.array(InboxItemSchema),
  unreadCount: z.number().int().min(0),
  /** Pass as `before` for the next page; null at the end. */
  nextCursor: z.uuid().nullable(),
});
export type Inbox = z.infer<typeof InboxSchema>;

export const InboxQuerySchema = z.object({
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type InboxQuery = z.infer<typeof InboxQuerySchema>;

export const UnreadCountSchema = z.object({ unreadCount: z.number().int().min(0) });
export type UnreadCount = z.infer<typeof UnreadCountSchema>;

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------
export const PreferenceCategorySchema = z.object({
  category: NotificationCategorySchema,
  /** Announcements and marketing: nothing arrives until the user turns it on. */
  optIn: z.boolean(),
  /** Holds critical notifications: they always arrive by at least one channel. */
  hasCritical: z.boolean(),
  channels: z.array(
    z.object({
      channel: NotificationChannelSchema,
      enabled: z.boolean(),
      /** In-app is the history outside opt-in categories: always on. */
      locked: z.boolean(),
    }),
  ),
});
export type PreferenceCategory = z.infer<typeof PreferenceCategorySchema>;

export const NotificationPreferencesSchema = z.object({
  categories: z.array(PreferenceCategorySchema),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const UpdatePreferencesRequestSchema = z.object({
  items: z
    .array(
      z.object({
        category: NotificationCategorySchema,
        channel: NotificationChannelSchema,
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(48),
});
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequestSchema>;

// ---------------------------------------------------------------------------
// Admin: types, rules and templates
// ---------------------------------------------------------------------------
export const NotificationAudienceSchema = z.enum([
  'entrant',
  'match_parties',
  'tournament_entrants',
  'tournament_staff',
  'opted_in',
]);
export type NotificationAudience = z.infer<typeof NotificationAudienceSchema>;

export const AdminNotificationTypeSchema = z.object({
  key: TypeKeySchema,
  category: NotificationCategorySchema,
  critical: z.boolean(),
  audience: NotificationAudienceSchema,
  defaultChannels: z.array(NotificationChannelSchema),
  /** The organization rule, or the defaults when there is none. */
  enabled: z.boolean(),
  channels: z.array(NotificationChannelSchema),
  hasRule: z.boolean(),
  /** Channels whose template the organization changed. */
  customized: z.array(NotificationChannelSchema),
});
export type AdminNotificationType = z.infer<typeof AdminNotificationTypeSchema>;

export const UpdateRuleRequestSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(NotificationChannelSchema).min(1).max(4),
});
export type UpdateRuleRequest = z.infer<typeof UpdateRuleRequestSchema>;

export const NotificationTemplateSchema = z.object({
  typeKey: TypeKeySchema,
  channel: NotificationChannelSchema,
  locale: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  variables: z.array(z.string()),
  version: z.number().int(),
  /** The organization's own text (false: the platform's base template). */
  customized: z.boolean(),
});
export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;

export const AdminNotificationTypeDetailSchema = z.object({
  type: AdminNotificationTypeSchema,
  templates: z.array(NotificationTemplateSchema),
  /** Variables available to this type, with an example value for the preview. */
  sampleVariables: z.record(z.string(), z.string()),
});
export type AdminNotificationTypeDetail = z.infer<typeof AdminNotificationTypeDetailSchema>;

export const SaveTemplateRequestSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});
export type SaveTemplateRequest = z.infer<typeof SaveTemplateRequestSchema>;

export const PreviewTemplateRequestSchema = SaveTemplateRequestSchema.extend({
  typeKey: TypeKeySchema,
  channel: NotificationChannelSchema,
});
export type PreviewTemplateRequest = z.infer<typeof PreviewTemplateRequestSchema>;

export const TemplatePreviewSchema = z.object({
  subject: z.string(),
  body: z.string(),
  /** Placeholders this type does not provide: they render empty. */
  unknown: z.array(z.string()),
});
export type TemplatePreview = z.infer<typeof TemplatePreviewSchema>;

// ---------------------------------------------------------------------------
// Admin: delivery history (automation monitor)
// ---------------------------------------------------------------------------
export const DeliverySchema = z.object({
  id: z.uuid(),
  typeKey: TypeKeySchema,
  channel: NotificationChannelSchema,
  status: DeliveryStatusSchema,
  subject: z.string().nullable(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  recipient: z.object({
    username: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  createdAt: IsoDateTime,
  sentAt: IsoDateTime.nullable(),
});
export type Delivery = z.infer<typeof DeliverySchema>;

export const DeliveryHistorySchema = z.object({
  items: z.array(DeliverySchema),
  nextCursor: z.uuid().nullable(),
  /** Deliveries by status (last 7 days). */
  counts: z.record(DeliveryStatusSchema, z.number().int()),
  /** Domain events still waiting to be turned into notifications, and dead ones. */
  outbox: z.object({ pending: z.number().int(), dead: z.number().int() }),
});
export type DeliveryHistory = z.infer<typeof DeliveryHistorySchema>;

export const DeliveryQuerySchema = z.object({
  status: DeliveryStatusSchema.optional(),
  channel: NotificationChannelSchema.optional(),
  before: z.uuid().optional(),
});
export type DeliveryQuery = z.infer<typeof DeliveryQuerySchema>;
