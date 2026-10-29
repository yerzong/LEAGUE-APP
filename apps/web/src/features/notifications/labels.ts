import type { NotificationChannel } from '@league/contracts';

import { messages } from '@/config/i18n';

/** Channels with a working adapter (Discord and push arrive in later modules). */
export const AVAILABLE_CHANNELS: readonly NotificationChannel[] = ['in_app', 'email'];

/** Spanish name of a notification type; the key when the catalog has a new one. */
export const typeLabel = (key: string): string => messages.notifications.types[key] ?? key;
