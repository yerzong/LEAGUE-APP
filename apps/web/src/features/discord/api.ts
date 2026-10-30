import 'server-only';

import { DiscordConfigSchema } from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

export const getDiscordConfig = () => apiRequest('/admin/discord', { schema: DiscordConfigSchema });
