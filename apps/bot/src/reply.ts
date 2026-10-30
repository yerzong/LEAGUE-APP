// Converts a BotReply (the API's composed message) into discord.js interaction
// reply options: an embed, an optional link button, and the ephemeral flag.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type InteractionReplyOptions,
} from 'discord.js';
import type { BotReply } from '@league/contracts';

export function toReplyOptions(reply: BotReply): InteractionReplyOptions {
  const options: InteractionReplyOptions = {};
  if (reply.content) options.content = reply.content;
  if (reply.embed) {
    const embed = new EmbedBuilder().setTitle(reply.embed.title).setColor(reply.embed.color);
    if (reply.embed.description) embed.setDescription(reply.embed.description);
    if (reply.embed.url) embed.setURL(reply.embed.url);
    if (reply.embed.footer) embed.setFooter({ text: reply.embed.footer });
    if (reply.embed.thumbnailUrl) embed.setThumbnail(reply.embed.thumbnailUrl);
    if (reply.embed.timestamp) embed.setTimestamp(new Date(reply.embed.timestamp));
    if (reply.embed.fields && reply.embed.fields.length > 0)
      embed.addFields(
        reply.embed.fields.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline ?? false,
        })),
      );
    options.embeds = [embed];
  }
  if (reply.link) {
    const button = new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(reply.link.label)
      .setURL(reply.link.url);
    options.components = [new ActionRowBuilder<ButtonBuilder>().addComponents(button)];
  }
  if (reply.ephemeral) options.flags = MessageFlags.Ephemeral;
  return options;
}
