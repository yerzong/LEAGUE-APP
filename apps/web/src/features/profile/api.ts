import 'server-only';

import {
  PrivacySettingsSchema,
  PrivateDataResponseSchema,
  ProfileResponseSchema,
  SocialLinksResponseSchema,
} from '@league/contracts';

import { apiRequest } from '@/lib/api/server-client';

export const getMyProfile = () => apiRequest('/me/profile', { schema: ProfileResponseSchema });
export const getMyPrivateData = () =>
  apiRequest('/me/private-data', { schema: PrivateDataResponseSchema });
export const getMyPrivacy = () => apiRequest('/me/privacy', { schema: PrivacySettingsSchema });
export const getMySocialLinks = () =>
  apiRequest('/me/social-links', { schema: SocialLinksResponseSchema });
