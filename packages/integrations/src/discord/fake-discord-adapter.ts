// In-memory DiscordPort for tests and the `stub` provider (local/CI): records
// every call, never touches the network. `failNext` simulates a Discord error.

import type {
  DiscordError,
  DiscordMessage,
  DiscordPort,
  SlashCommand,
  TempVoiceChannel,
} from './ports.js';

export interface SentDirectMessage {
  readonly discordUserId: string;
  readonly message: DiscordMessage;
}
export interface SentChannelMessage {
  readonly channelId: string;
  readonly message: DiscordMessage;
}
export interface CreatedChannel {
  readonly channelId: string;
  readonly guildId: string;
  readonly name: string;
  readonly parentId: string | null;
}
export interface RoleChange {
  readonly guildId: string;
  readonly discordUserId: string;
  readonly roleId: string;
}

export class FakeDiscordAdapter implements DiscordPort {
  readonly dms: SentDirectMessage[] = [];
  readonly channelMessages: SentChannelMessage[] = [];
  readonly channels: CreatedChannel[] = [];
  readonly deletedChannels: string[] = [];
  readonly rolesAdded: RoleChange[] = [];
  readonly rolesRemoved: RoleChange[] = [];
  readonly registeredCommands: SlashCommand[] = [];
  private error: DiscordError | null = null;
  private sequence = 0;

  /** The next call throws this error, then clears. */
  failNext(error: DiscordError): void {
    this.error = error;
  }

  private check(): void {
    if (this.error) {
      const error = this.error;
      this.error = null;
      throw error;
    }
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence)}`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- check() must reject, not throw sync.
  async sendDirectMessage(discordUserId: string, message: DiscordMessage) {
    this.check();
    this.dms.push({ discordUserId, message });
    return { messageId: this.nextId('dm') };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async sendChannelMessage(channelId: string, message: DiscordMessage) {
    this.check();
    this.channelMessages.push({ channelId, message });
    return { messageId: this.nextId('msg') };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createVoiceChannel(
    guildId: string,
    name: string,
    options: { readonly parentId: string | null; readonly userLimit?: number },
  ): Promise<TempVoiceChannel> {
    this.check();
    const channelId = this.nextId('voice');
    this.channels.push({ channelId, guildId, name, parentId: options.parentId });
    return { channelId };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteChannel(channelId: string) {
    this.check();
    this.deletedChannels.push(channelId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async addRole(guildId: string, discordUserId: string, roleId: string) {
    this.check();
    this.rolesAdded.push({ guildId, discordUserId, roleId });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async removeRole(guildId: string, discordUserId: string, roleId: string) {
    this.check();
    this.rolesRemoved.push({ guildId, discordUserId, roleId });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async setGuildCommands(
    _applicationId: string,
    _guildId: string,
    commands: readonly SlashCommand[],
  ) {
    this.check();
    this.registeredCommands.splice(0, this.registeredCommands.length, ...commands);
  }
}
