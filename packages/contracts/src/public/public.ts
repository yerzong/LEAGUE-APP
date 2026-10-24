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

export type PublicTeamMember = z.infer<typeof PublicTeamMemberSchema>;
export type PublicTeam = z.infer<typeof PublicTeamSchema>;
export type PublicPlayer = z.infer<typeof PublicPlayerSchema>;
