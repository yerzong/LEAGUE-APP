import { z } from 'zod';

// The bot reads the platform API over HTTP (business logic stays in the API) and
// talks to Discord with discord.js. Without a token it does not start; the rest
// of the stack keeps running (docs/specs/m07 §1).
export const BotEnvSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DISCORD_BOT_API_SECRET: z.string().min(16).optional(),
  API_URL: z.url().default('http://localhost:4000'),
});

export type BotEnv = z.infer<typeof BotEnvSchema>;

export interface BotConfig {
  readonly token: string;
  readonly clientId: string;
  readonly guildId: string;
  readonly apiSecret: string;
  readonly apiUrl: string;
}

/**
 * The config when the bot is fully configured, or `null` (with the reason) when
 * it should stay disabled. Never throws: a missing token is a normal state.
 */
export function resolveConfig(source: NodeJS.ProcessEnv = process.env): {
  config: BotConfig | null;
  reason: string | null;
} {
  const parsed = BotEnvSchema.safeParse(source);
  if (!parsed.success) return { config: null, reason: 'invalid bot environment' };
  const env = parsed.data;
  const missing = (
    [
      'DISCORD_BOT_TOKEN',
      'DISCORD_CLIENT_ID',
      'DISCORD_GUILD_ID',
      'DISCORD_BOT_API_SECRET',
    ] as const
  ).filter((name) => !env[name]);
  if (missing.length > 0) return { config: null, reason: `missing ${missing.join(', ')}` };
  return {
    config: {
      token: env.DISCORD_BOT_TOKEN as string,
      clientId: env.DISCORD_CLIENT_ID as string,
      guildId: env.DISCORD_GUILD_ID as string,
      apiSecret: env.DISCORD_BOT_API_SECRET as string,
      apiUrl: env.API_URL.replace(/\/$/, ''),
    },
    reason: null,
  };
}
