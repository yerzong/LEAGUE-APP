// DiscordPort over the Discord REST API (@discordjs/rest). No gateway
// connection: this only sends messages, manages channels and roles, and
// registers commands — everything the API worker and the bot process need
// without holding a socket. The bot token never leaves this adapter.

import { REST } from '@discordjs/rest';
import {
  ApplicationCommandOptionType,
  ButtonStyle,
  ChannelType,
  ComponentType,
  Routes,
  type RESTError,
} from 'discord-api-types/v10';

import {
  DiscordError,
  type DiscordMessage,
  type DiscordPort,
  type SlashCommand,
  type TempVoiceChannel,
} from './ports.js';

export interface DiscordRestOptions {
  readonly token: string;
  /** Injectable for tests; defaults to a real REST client. */
  readonly rest?: Pick<REST, 'get' | 'post' | 'put' | 'delete'>;
}

interface RawMessage {
  id: string;
}
interface RawChannel {
  id: string;
}

const OPTION_TYPE = {
  3: ApplicationCommandOptionType.String,
  6: ApplicationCommandOptionType.User,
} as const;

/** Translates an HTTP error from discord into our typed DiscordError. */
function toDiscordError(error: unknown): DiscordError {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? ((error as { status?: number }).status ?? null)
      : null;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as RESTError).code
      : null;
  if (status === 401) return new DiscordError('unauthorized', status);
  // 50007: cannot send messages to this user (DMs closed).
  if (code === 50007) return new DiscordError('cannot_dm', status);
  if (status === 403) return new DiscordError('forbidden', status);
  if (status === 404) return new DiscordError('not_found', status);
  if (status === 429) return new DiscordError('rate_limited', status);
  return new DiscordError('unavailable', status);
}

/** Message → Discord REST payload (embed + optional link button). */
function toPayload(message: DiscordMessage): Record<string, unknown> {
  const embeds = message.embed
    ? [
        {
          title: message.embed.title,
          description: message.embed.description,
          color: message.embed.color,
          url: message.embed.url,
          fields: message.embed.fields?.map((f) => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false,
          })),
          footer: message.embed.footer ? { text: message.embed.footer } : undefined,
          thumbnail: message.embed.thumbnailUrl ? { url: message.embed.thumbnailUrl } : undefined,
          timestamp: message.embed.timestamp,
        },
      ]
    : undefined;
  const components = message.link
    ? [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              style: ButtonStyle.Link,
              label: message.link.label,
              url: message.link.url,
            },
          ],
        },
      ]
    : undefined;
  return {
    ...(message.content ? { content: message.content } : {}),
    ...(embeds ? { embeds } : {}),
    ...(components ? { components } : {}),
  };
}

export class DiscordRestAdapter implements DiscordPort {
  private readonly rest: Pick<REST, 'get' | 'post' | 'put' | 'delete'>;

  constructor(options: DiscordRestOptions) {
    this.rest = options.rest ?? new REST({ version: '10' }).setToken(options.token);
  }

  async sendDirectMessage(
    discordUserId: string,
    message: DiscordMessage,
  ): Promise<{ messageId: string }> {
    try {
      const channel = (await this.rest.post(Routes.userChannels(), {
        body: { recipient_id: discordUserId },
      })) as RawChannel;
      const sent = (await this.rest.post(Routes.channelMessages(channel.id), {
        body: toPayload(message),
      })) as RawMessage;
      return { messageId: sent.id };
    } catch (error) {
      throw toDiscordError(error);
    }
  }

  async sendChannelMessage(
    channelId: string,
    message: DiscordMessage,
  ): Promise<{ messageId: string }> {
    try {
      const sent = (await this.rest.post(Routes.channelMessages(channelId), {
        body: toPayload(message),
      })) as RawMessage;
      return { messageId: sent.id };
    } catch (error) {
      throw toDiscordError(error);
    }
  }

  async createVoiceChannel(
    guildId: string,
    name: string,
    options: { readonly parentId: string | null; readonly userLimit?: number },
  ): Promise<TempVoiceChannel> {
    try {
      const channel = (await this.rest.post(Routes.guildChannels(guildId), {
        body: {
          name,
          type: ChannelType.GuildVoice,
          parent_id: options.parentId ?? undefined,
          user_limit: options.userLimit,
        },
      })) as RawChannel;
      return { channelId: channel.id };
    } catch (error) {
      throw toDiscordError(error);
    }
  }

  async deleteChannel(channelId: string): Promise<void> {
    try {
      await this.rest.delete(Routes.channel(channelId));
    } catch (error) {
      throw toDiscordError(error);
    }
  }

  async addRole(guildId: string, discordUserId: string, roleId: string): Promise<void> {
    try {
      await this.rest.put(Routes.guildMemberRole(guildId, discordUserId, roleId));
    } catch (error) {
      throw toDiscordError(error);
    }
  }

  async removeRole(guildId: string, discordUserId: string, roleId: string): Promise<void> {
    try {
      await this.rest.delete(Routes.guildMemberRole(guildId, discordUserId, roleId));
    } catch (error) {
      throw toDiscordError(error);
    }
  }

  async setGuildCommands(
    applicationId: string,
    guildId: string,
    commands: readonly SlashCommand[],
  ): Promise<void> {
    try {
      await this.rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
        body: commands.map((c) => ({
          name: c.name,
          description: c.description,
          options: c.options?.map((o) => ({
            name: o.name,
            description: o.description,
            type: OPTION_TYPE[o.type],
            required: o.required,
          })),
        })),
      });
    } catch (error) {
      throw toDiscordError(error);
    }
  }
}
