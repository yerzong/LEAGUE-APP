// The discord.js gateway: registers the slash commands for the guild on start
// and routes each interaction through the dispatcher to the API. All replies
// come back as ready messages; the bot only adapts the discord.js shapes.

import { SLASH_COMMANDS, DiscordRestAdapter } from '@league/integrations';
import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Interaction,
} from 'discord.js';

import { BotApiClient } from './api-client.js';
import type { BotConfig } from './config.js';
import { dispatchCommand, type CommandInvocation } from './dispatch.js';
import { toReplyOptions } from './reply.js';

function invocationOf(interaction: ChatInputCommandInteraction): CommandInvocation {
  return {
    commandName: interaction.commandName,
    actor: {
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
    },
    getString: (name) => interaction.options.getString(name),
    getUserId: (name) => interaction.options.getUser(name)?.id ?? null,
  };
}

export async function startBot(config: BotConfig): Promise<Client> {
  const api = new BotApiClient({ apiUrl: config.apiUrl, apiSecret: config.apiSecret });
  const rest = new DiscordRestAdapter({ token: config.token });

  // Register the slash commands up front (idempotent overwrite).
  await rest.setGuildCommands(config.clientId, config.guildId, SLASH_COMMANDS);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    void handleInteraction(api, interaction);
  });

  await client.login(config.token);
  return client;
}

async function handleInteraction(
  api: BotApiClient,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const reply = await dispatchCommand(api, invocationOf(interaction));
    await interaction.reply(toReplyOptions(reply));
  } catch {
    if (!interaction.replied && !interaction.deferred)
      await interaction.reply({ content: 'Algo salió mal.', flags: MessageFlags.Ephemeral });
  }
}
