// Maps a slash-command invocation to the API call and shapes the reply. Kept
// free of discord.js so it is unit-testable; bot.ts adapts discord.js
// interactions to the small CommandInvocation shape below.

import type { BotReply } from '@league/contracts';
import { DISCORD_COMMANDS } from '@league/integrations';

import type { BotActor, BotApiClient } from './api-client.js';

/** The slice of a slash-command interaction the dispatcher needs. */
export interface CommandInvocation {
  readonly commandName: string;
  readonly actor: BotActor;
  getString(name: string): string | null;
  getUserId(name: string): string | null;
}

const UNKNOWN: BotReply = { content: 'Comando no reconocido.', ephemeral: true };
const MISSING_ARG = (what: string): BotReply => ({
  content: `Falta el ${what}.`,
  ephemeral: true,
});

export async function dispatchCommand(
  api: BotApiClient,
  invocation: CommandInvocation,
): Promise<BotReply> {
  const { actor } = invocation;
  switch (invocation.commandName) {
    case DISCORD_COMMANDS.proximo:
      return api.nextMatch(actor);
    case DISCORD_COMMANDS.checkin:
      return api.checkin(actor);
    case DISCORD_COMMANDS.tabla: {
      const tournament = invocation.getString('torneo');
      return tournament ? api.standings(actor, tournament) : MISSING_ARG('torneo');
    }
    case DISCORD_COMMANDS.perfil:
      return api.player(actor, invocation.getUserId('usuario') ?? undefined);
    case DISCORD_COMMANDS.equipo: {
      const name = invocation.getString('nombre');
      return name ? api.team(actor, name) : MISSING_ARG('nombre del equipo');
    }
    case DISCORD_COMMANDS.vincular:
      return api.link(actor);
    default:
      return UNKNOWN;
  }
}
