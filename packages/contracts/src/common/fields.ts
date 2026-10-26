import { z } from 'zod';

/** Empty strings from forms become null; values are trimmed. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

export const PlayerRoleSchema = z.enum(['top', 'jungle', 'mid', 'adc', 'support']);
/** Riot platforms supported for now (Americas routing). */
export const GameRegionSchema = z.enum(['la1', 'la2', 'na1', 'br1']);
export const PrivacyVisibilitySchema = z.enum(['public', 'team', 'staff', 'private']);
export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);
/** `YYYY-MM-DD`. */
export const IsoDateSchema = z.iso.date();

export type PlayerRole = z.infer<typeof PlayerRoleSchema>;
export type GameRegion = z.infer<typeof GameRegionSchema>;
export type PrivacyVisibility = z.infer<typeof PrivacyVisibilitySchema>;

export const PLAYER_ROLES = PlayerRoleSchema.options;
export const GAME_REGIONS = GameRegionSchema.options;
export const PRIVACY_VISIBILITIES = PrivacyVisibilitySchema.options;

/** Error body of every API failure. `code` is stable; the UI maps it to i18n. */
export const ApiErrorSchema = z.object({
  code: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Image uploads (avatar, team logo). Checked again on the server from the bytes. */
export const IMAGE_UPLOAD = {
  maxBytes: 2 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
} as const;
