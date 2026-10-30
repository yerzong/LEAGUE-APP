// DiscordPort (docs/04 §5, m07): what the platform needs from Discord, behind
// a port so domain and API code never touch discord.js or the REST wire.
// Adapters: a REST client (@discordjs/rest) and a fake for tests/CI.

/** A message the bot sends (an embed, optionally with content and a link button). */
export interface DiscordMessage {
  readonly content?: string;
  readonly embed?: DiscordEmbed;
  /** A single link button row (jump to the platform). */
  readonly link?: { readonly label: string; readonly url: string };
}

export interface DiscordEmbed {
  readonly title: string;
  readonly description?: string;
  /** Decimal color (brand token resolved server side). */
  readonly color: number;
  readonly url?: string;
  readonly fields?: readonly {
    readonly name: string;
    readonly value: string;
    readonly inline?: boolean;
  }[];
  readonly footer?: string;
  readonly thumbnailUrl?: string;
  readonly timestamp?: string;
}

export interface TempVoiceChannel {
  readonly channelId: string;
}

export type DiscordErrorKind =
  'unauthorized' | 'forbidden' | 'not_found' | 'cannot_dm' | 'rate_limited' | 'unavailable';

/** A failure talking to Discord. Never carries the bot token. */
export class DiscordError extends Error {
  constructor(
    readonly kind: DiscordErrorKind,
    readonly status: number | null = null,
  ) {
    super(`Discord error: ${kind}${status === null ? '' : ` (${String(status)})`}`);
    this.name = 'DiscordError';
  }

  /** Whether a notification delivery should be retried (transient failures only). */
  get retryable(): boolean {
    return this.kind === 'rate_limited' || this.kind === 'unavailable';
  }
}

export interface DiscordPort {
  /** Opens a DM and sends it. Throws DiscordError('cannot_dm') if the user blocks DMs. */
  sendDirectMessage(discordUserId: string, message: DiscordMessage): Promise<{ messageId: string }>;
  sendChannelMessage(channelId: string, message: DiscordMessage): Promise<{ messageId: string }>;
  /** Creates a temporary voice channel under a category. */
  createVoiceChannel(
    guildId: string,
    name: string,
    options: { readonly parentId: string | null; readonly userLimit?: number },
  ): Promise<TempVoiceChannel>;
  deleteChannel(channelId: string): Promise<void>;
  addRole(guildId: string, discordUserId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, discordUserId: string, roleId: string): Promise<void>;
  /** Overwrites the guild's slash commands (idempotent registration). */
  setGuildCommands(
    applicationId: string,
    guildId: string,
    commands: readonly SlashCommand[],
  ): Promise<void>;
}

/** A slash command definition (pure data; the bot wires the handlers). */
export interface SlashCommand {
  readonly name: string;
  readonly description: string;
  readonly options?: readonly SlashCommandOption[];
}

export interface SlashCommandOption {
  readonly name: string;
  readonly description: string;
  /** Discord application command option type: 3 string, 6 user. */
  readonly type: 3 | 6;
  readonly required: boolean;
}
