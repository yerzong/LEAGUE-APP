import { z } from 'zod';

import {
  CountryCodeSchema,
  GameRegionSchema,
  IsoDateSchema,
  optionalText,
  PlayerRoleSchema,
  PrivacyVisibilitySchema,
} from '../common/fields.js';

export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

export const DisplayNameSchema = z.string().trim().min(1).max(50);

const BirthDateSchema = IsoDateSchema.refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() >= 1900 && date.getTime() < Date.now();
}, 'birth_date_out_of_range');

export const UpdateProfileRequestSchema = z
  .object({
    displayName: DisplayNameSchema,
    username: UsernameSchema,
    countryCode: CountryCodeSchema,
    gameRegion: GameRegionSchema,
    birthDate: BirthDateSchema,
    primaryRole: PlayerRoleSchema.nullable(),
    secondaryRole: PlayerRoleSchema.nullable(),
    bio: optionalText(280),
  })
  .refine((p) => p.primaryRole === null || p.primaryRole !== p.secondaryRole, {
    path: ['secondaryRole'],
    message: 'roles_must_differ',
  });

/** Steps still missing to compete (docs/12 §3 and §6). */
export const OnboardingStepSchema = z.enum([
  'username',
  'country',
  'game_region',
  'birth_date',
  'riot_account',
  'roles',
]);

export const ProfileResponseSchema = z.object({
  id: z.uuid(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  countryCode: z.string().nullable(),
  gameRegion: GameRegionSchema.nullable(),
  birthDate: IsoDateSchema.nullable(),
  primaryRole: PlayerRoleSchema.nullable(),
  secondaryRole: PlayerRoleSchema.nullable(),
  bio: z.string().nullable(),
  isFreeAgent: z.boolean(),
  missing: z.array(OnboardingStepSchema),
});

export const GenderSchema = z.enum(['woman', 'man', 'non_binary', 'prefer_not_to_say']);

export const UpdatePrivateDataRequestSchema = z.object({
  legalFirstName: optionalText(80),
  legalLastName: optionalText(80),
  phoneE164: optionalText(16).pipe(
    z
      .string()
      .regex(/^\+[1-9][0-9]{6,14}$/)
      .nullable(),
  ),
  institutionalEmail: optionalText(254).pipe(z.email().nullable()),
  /** Ignored once declared: changing it needs a reviewed request. */
  gender: GenderSchema.nullable(),
});

export const PrivateDataResponseSchema = z.object({
  legalFirstName: z.string().nullable(),
  legalLastName: z.string().nullable(),
  phoneE164: z.string().nullable(),
  institutionalEmail: z.string().nullable(),
  gender: GenderSchema.nullable(),
  genderDeclaredAt: z.iso.datetime({ offset: true }).nullable(),
  genderLocked: z.boolean(),
});

/** Profile fields whose visibility the user controls. */
export const PrivacyFieldSchema = z.enum([
  'country',
  'game_region',
  'roles',
  'bio',
  'riot_account',
  'teams',
  'age',
]);

export const PrivacySettingsSchema = z.record(PrivacyFieldSchema, PrivacyVisibilitySchema);

export const DEFAULT_PRIVACY: Readonly<
  Record<z.infer<typeof PrivacyFieldSchema>, z.infer<typeof PrivacyVisibilitySchema>>
> = {
  country: 'public',
  game_region: 'public',
  roles: 'public',
  bio: 'public',
  riot_account: 'public',
  teams: 'public',
  age: 'private',
};

export const SocialPlatformSchema = z.enum([
  'twitch',
  'youtube',
  'tiktok',
  'x',
  'instagram',
  'kick',
  'other',
]);

export const SocialLinkSchema = z.object({
  platform: SocialPlatformSchema,
  url: z.url({ protocol: /^https$/ }).max(300),
  handle: optionalText(60),
  visibility: PrivacyVisibilitySchema,
});

export const UpdateSocialLinksRequestSchema = z.object({
  links: z.array(SocialLinkSchema).max(8),
});

export const SocialLinksResponseSchema = UpdateSocialLinksRequestSchema;

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type UpdateProfileInput = z.input<typeof UpdateProfileRequestSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type UpdatePrivateDataRequest = z.infer<typeof UpdatePrivateDataRequestSchema>;
export type UpdatePrivateDataInput = z.input<typeof UpdatePrivateDataRequestSchema>;
export type PrivateDataResponse = z.infer<typeof PrivateDataResponseSchema>;
export type PrivacyField = z.infer<typeof PrivacyFieldSchema>;
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;
export type SocialLink = z.infer<typeof SocialLinkSchema>;
export type UpdateSocialLinksRequest = z.infer<typeof UpdateSocialLinksRequestSchema>;

export const PRIVACY_FIELDS = PrivacyFieldSchema.options;
export const SOCIAL_PLATFORMS = SocialPlatformSchema.options;
export const GENDERS = GenderSchema.options;
