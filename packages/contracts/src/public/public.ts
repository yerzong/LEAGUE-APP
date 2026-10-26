import { z } from 'zod';

import { GameRegionSchema, PlayerRoleSchema } from '../common/fields.js';
import { SocialPlatformSchema } from '../profile/profile.js';
import { TeamRoleSchema, TeamStatusSchema } from '../teams/teams.js';

/** Only what each player made visible to the viewer is present (others are null/empty). */
export const PublicTeamMemberSchema = z.object({
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  teamRole: TeamRoleSchema,
  primaryRole: PlayerRoleSchema.nullable(),
  riotId: z.string().nullable(),
});

export const PublicTeamSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  tag: z.string(),
  region: GameRegionSchema,
  logoUrl: z.url().nullable(),
  description: z.string().nullable(),
  status: TeamStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  members: z.array(PublicTeamMemberSchema),
});

export const PublicPlayerSchema = z.object({
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  bio: z.string().nullable(),
  countryCode: z.string().nullable(),
  gameRegion: GameRegionSchema.nullable(),
  primaryRole: PlayerRoleSchema.nullable(),
  secondaryRole: PlayerRoleSchema.nullable(),
  /** Never a birth date: only whether the player is an adult, if shared. */
  isAdult: z.boolean().nullable(),
  riotAccount: z
    .object({ gameName: z.string(), tagLine: z.string(), region: GameRegionSchema })
    .nullable(),
  teams: z.array(
    z.object({ slug: z.string(), name: z.string(), tag: z.string(), teamRole: TeamRoleSchema }),
  ),
  socialLinks: z.array(
    z.object({ platform: SocialPlatformSchema, url: z.url(), handle: z.string().nullable() }),
  ),
});

/** Search text for the public directories: letters, digits, spaces and `_ . -`. */
const DirectorySearchSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[\p{L}\p{N} _.-]*$/u)
  .default('');

/** Query of `/public/teams` and `/public/players`. Pages start at 1. */
export const DirectoryQuerySchema = z.object({
  q: DirectorySearchSchema,
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });

/** Active teams only. */
export const PublicTeamListItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tag: z.string(),
  region: GameRegionSchema,
  logoUrl: z.url().nullable(),
  memberCount: z.number().int().min(0),
});

/** Name and avatar are always public; the rest follows the player's privacy. */
export const PublicPlayerListItemSchema = z.object({
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  primaryRole: PlayerRoleSchema.nullable(),
  gameRegion: GameRegionSchema.nullable(),
  riotVerified: z.boolean(),
});

export const PublicTeamListSchema = pageOf(PublicTeamListItemSchema);
export const PublicPlayerListSchema = pageOf(PublicPlayerListItemSchema);

export type PublicTeamMember = z.infer<typeof PublicTeamMemberSchema>;
export type PublicTeam = z.infer<typeof PublicTeamSchema>;
export type PublicPlayer = z.infer<typeof PublicPlayerSchema>;
export type DirectoryQuery = z.infer<typeof DirectoryQuerySchema>;
export type PublicTeamListItem = z.infer<typeof PublicTeamListItemSchema>;
export type PublicPlayerListItem = z.infer<typeof PublicPlayerListItemSchema>;
export type PublicTeamList = z.infer<typeof PublicTeamListSchema>;
export type PublicPlayerList = z.infer<typeof PublicPlayerListSchema>;
