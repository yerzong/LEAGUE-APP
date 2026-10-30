import { z } from 'zod';

// Module 07: Discord bot — the admin console config and the bot↔API contract
// (docs/specs/m07). The bot stays thin: the API composes each reply as a ready
// Discord message; the bot just sends it.

const Snowflake = z
  .string()
  .regex(/^[0-9]{5,25}$/, 'a Discord id')
  .nullable();
const SnowflakeRequired = z.string().regex(/^[0-9]{5,25}$/, 'a Discord id');

export const DISCORD_CHANNEL_PURPOSES = [
  'announcements',
  'results',
  'staff',
  'match_voice_category',
] as const;
export const DiscordChannelPurposeSchema = z.enum(DISCORD_CHANNEL_PURPOSES);
export type DiscordChannelPurpose = z.infer<typeof DiscordChannelPurposeSchema>;

export const DISCORD_FEATURES = [
  'checkin',
  'voiceChannels',
  'autoRoles',
  'staffAlerts',
  'results',
] as const;
export const DiscordFeatureSchema = z.enum(DISCORD_FEATURES);
export type DiscordFeature = z.infer<typeof DiscordFeatureSchema>;

// ---------------------------------------------------------------------------
// Admin console (/admin/discord)
// ---------------------------------------------------------------------------
export const DiscordChannelSettingSchema = z.object({
  purpose: DiscordChannelPurposeSchema,
  channelId: Snowflake,
});

export const DiscordConfigSchema = z.object({
  /** Null until the guild is connected. */
  guildId: Snowflake,
  guildName: z.string().nullable(),
  connected: z.boolean(),
  /** Whether the API has a bot token (so sending is actually possible). */
  botReady: z.boolean(),
  features: z.partialRecord(DiscordFeatureSchema, z.boolean()),
  channels: z.array(DiscordChannelSettingSchema),
  /** Role id given to players who verified their Riot account. */
  verifiedRoleId: Snowflake,
});
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

export const SaveDiscordGuildRequestSchema = z.object({
  guildId: SnowflakeRequired,
  guildName: z.string().trim().max(120).optional(),
  features: z.partialRecord(DiscordFeatureSchema, z.boolean()),
  verifiedRoleId: Snowflake.optional(),
});
export type SaveDiscordGuildRequest = z.infer<typeof SaveDiscordGuildRequestSchema>;

export const SetDiscordChannelRequestSchema = z.object({
  purpose: DiscordChannelPurposeSchema,
  /** Null clears the mapping. */
  channelId: Snowflake,
});
export type SetDiscordChannelRequest = z.infer<typeof SetDiscordChannelRequestSchema>;

// ---------------------------------------------------------------------------
// Bot ↔ API: a composed Discord message the bot sends verbatim
// ---------------------------------------------------------------------------
export const DiscordEmbedFieldSchema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().optional(),
});
export const DiscordEmbedSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  color: z.number().int(),
  url: z.url().optional(),
  fields: z.array(DiscordEmbedFieldSchema).optional(),
  footer: z.string().optional(),
  thumbnailUrl: z.url().optional(),
  timestamp: z.iso.datetime({ offset: true }).optional(),
});
export const BotReplySchema = z.object({
  content: z.string().optional(),
  embed: DiscordEmbedSchema.optional(),
  link: z.object({ label: z.string(), url: z.url() }).optional(),
  /** Only the caller sees it (errors, link prompts). */
  ephemeral: z.boolean().default(false),
});
export type BotReply = z.infer<typeof BotReplySchema>;

/** Every bot request carries who invoked it on Discord. */
export const BotActorSchema = z.object({
  discordUserId: SnowflakeRequired,
  /** Display name, for the audit trail only. */
  discordUsername: z.string().max(60).optional(),
});

export const BotCheckinRequestSchema = BotActorSchema;
export type BotCheckinRequest = z.infer<typeof BotCheckinRequestSchema>;

export const BotNextMatchRequestSchema = BotActorSchema;

export const BotStandingsRequestSchema = BotActorSchema.extend({
  /** Tournament slug or name typed by the user. */
  tournament: z.string().trim().min(1).max(90),
});

export const BotPlayerRequestSchema = BotActorSchema.extend({
  /** The mentioned user's Discord id, or omitted for the caller. */
  targetDiscordUserId: SnowflakeRequired.optional(),
});

export const BotTeamRequestSchema = BotActorSchema.extend({
  name: z.string().trim().min(1).max(60),
});

export const BotLinkRequestSchema = BotActorSchema;

// What the bot needs on startup: which commands to register and where.
export const BotRuntimeConfigSchema = z.object({
  connected: z.boolean(),
  guildId: Snowflake,
});
export type BotRuntimeConfig = z.infer<typeof BotRuntimeConfigSchema>;

// Match operations the API asks the bot nothing about; the bot calls these.
export const BotMatchVoiceRequestSchema = z.object({
  matchId: z.uuid(),
});

export const VoiceChannelPlanSchema = z.object({
  /** Null when the guild has no voice category configured or the feature is off. */
  guildId: Snowflake,
  categoryId: Snowflake,
  channels: z.array(
    z.object({
      entrantId: z.uuid(),
      name: z.string(),
    }),
  ),
});
export type VoiceChannelPlan = z.infer<typeof VoiceChannelPlanSchema>;
