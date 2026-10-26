import { z } from 'zod';

import { GameRegionSchema } from '../common/fields.js';

/** Riot ID parts (`Nombre#TAG`). Riot allows 3–16 and 3–5 characters; old tags have 2. */
export const RiotGameNameSchema = z.string().trim().min(3).max(16);
export const RiotTagLineSchema = z
  .string()
  .trim()
  .regex(/^[\p{L}\p{N}]{2,5}$/u);

export const StartRiotVerificationRequestSchema = z.object({
  gameName: RiotGameNameSchema,
  tagLine: RiotTagLineSchema,
  region: GameRegionSchema,
});

export const RiotVerificationStatusSchema = z.enum(['pending', 'verified', 'expired', 'failed']);

export const RiotVerificationResponseSchema = z.object({
  id: z.uuid(),
  gameName: z.string(),
  tagLine: z.string(),
  region: GameRegionSchema,
  expectedIconId: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime({ offset: true }),
  status: RiotVerificationStatusSchema,
});

export const RankTierSchema = z.enum([
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
  'master',
  'grandmaster',
  'challenger',
]);

export const RiotRankSchema = z.object({
  queue: z.enum(['solo', 'flex']),
  tier: RankTierSchema,
  division: z.number().int().min(1).max(4).nullable(),
  lp: z.number().int(),
});

export const RiotAccountResponseSchema = z.object({
  gameName: z.string(),
  tagLine: z.string(),
  region: GameRegionSchema,
  summonerLevel: z.number().int().nullable(),
  profileIconId: z.number().int().nullable(),
  verifiedAt: z.iso.datetime({ offset: true }),
  ranks: z.array(RiotRankSchema),
});

/** `null` while the user has not linked an account. */
export const MyRiotAccountResponseSchema = z.object({
  account: RiotAccountResponseSchema.nullable(),
  pendingVerification: RiotVerificationResponseSchema.nullable(),
});

export const ReasonSchema = z.string().trim().min(10).max(500);

export const UnlinkRiotAccountRequestSchema = z.object({ reason: ReasonSchema });

export type StartRiotVerificationRequest = z.infer<typeof StartRiotVerificationRequestSchema>;
export type RiotVerificationResponse = z.infer<typeof RiotVerificationResponseSchema>;
export type RiotAccountResponse = z.infer<typeof RiotAccountResponseSchema>;
export type MyRiotAccountResponse = z.infer<typeof MyRiotAccountResponseSchema>;
export type RiotRank = z.infer<typeof RiotRankSchema>;
export type RankTier = z.infer<typeof RankTierSchema>;
export type UnlinkRiotAccountRequest = z.infer<typeof UnlinkRiotAccountRequestSchema>;
