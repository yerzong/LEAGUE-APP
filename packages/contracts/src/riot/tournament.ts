import { z } from 'zod';

import { GameRegionSchema } from '../common/fields.js';

// Module 08: Riot Tournament API — the admin integration status, the per-game
// tournament codes shown to captains, and the result callback (docs/specs/m08).
const IsoDateTime = z.iso.datetime({ offset: true });

export const RIOT_PROVIDERS = ['riot', 'stub', 'manual'] as const;
export const RiotProviderSchema = z.enum(RIOT_PROVIDERS);
export type RiotProvider = z.infer<typeof RiotProviderSchema>;

export const TOURNAMENT_CODE_STATUSES = ['active', 'used', 'revoked'] as const;
export const TournamentCodeStatusSchema = z.enum(TOURNAMENT_CODE_STATUSES);
export type TournamentCodeStatus = z.infer<typeof TournamentCodeStatusSchema>;

/** A code the captain pastes to create the custom lobby (docs/13 §7). */
export const TournamentCodeSchema = z.object({
  gameNumber: z.number().int().positive(),
  code: z.string(),
  status: TournamentCodeStatusSchema,
  teamSize: z.number().int().min(1).max(5),
  allowedCount: z.number().int().min(0),
  generatedAt: IsoDateTime,
  usedAt: IsoDateTime.nullable(),
});
export type TournamentCode = z.infer<typeof TournamentCodeSchema>;

export const MatchCodesSchema = z.object({
  /** The tournament runs in Riot-automatic mode (codes are generated). */
  automatic: z.boolean(),
  codes: z.array(TournamentCodeSchema),
});
export type MatchCodes = z.infer<typeof MatchCodesSchema>;

// ---------------------------------------------------------------------------
// Admin integration status
// ---------------------------------------------------------------------------
export const RiotCallbackLogSchema = z.object({
  eventType: z.string(),
  status: z.enum(['received', 'processed', 'failed', 'skipped']),
  receivedAt: IsoDateTime,
  error: z.string().nullable(),
});

export const RiotIntegrationStatusSchema = z.object({
  provider: RiotProviderSchema,
  /** The provider can actually reach Riot (a key is configured). */
  live: z.boolean(),
  supervision: z.enum(['automatic', 'dual_report', 'referee', 'broadcast']),
  connected: z.boolean(),
  region: GameRegionSchema.nullable(),
  riotTournamentId: z.number().int().nullable(),
  codesGenerated: z.number().int().min(0),
  codesUsed: z.number().int().min(0),
  recentCallbacks: z.array(RiotCallbackLogSchema),
  openIntegrityAlerts: z.number().int().min(0),
});
export type RiotIntegrationStatus = z.infer<typeof RiotIntegrationStatusSchema>;

export const ConnectRiotResponseSchema = z.object({ riotTournamentId: z.number().int() });
export type ConnectRiotResponse = z.infer<typeof ConnectRiotResponseSchema>;

export const GenerateCodeRequestSchema = z.object({
  /** Which game of the series; defaults to the next unplayed one. */
  gameNumber: z.number().int().min(1).max(9).optional(),
});
export type GenerateCodeRequest = z.infer<typeof GenerateCodeRequestSchema>;

// ---------------------------------------------------------------------------
// Result callback (Tournament-V5). Tolerant of Riot's and the stub's shapes.
// ---------------------------------------------------------------------------
export const RiotCallbackSchema = z
  .object({
    shortCode: z.string().min(3).max(120),
    region: z.string().max(10).optional(),
    /** Riot's numeric game id; the match id is `<platform>_<gameId>`. */
    gameId: z.number().int().positive().optional(),
    /** The already-formed Match-V5 id (the stub sends this directly). */
    matchId: z.string().max(40).optional(),
    metaData: z.string().max(200).optional(),
    metadata: z.string().max(200).optional(),
  })
  .refine((c) => c.matchId !== undefined || c.gameId !== undefined, {
    message: 'matchId or gameId is required',
  });
export type RiotCallback = z.infer<typeof RiotCallbackSchema>;

export const RiotCallbackAckSchema = z.object({
  /** processed = completed now; duplicate = already handled; skipped = not automatic. */
  status: z.enum(['processed', 'duplicate', 'skipped', 'pending']),
});
export type RiotCallbackAck = z.infer<typeof RiotCallbackAckSchema>;
