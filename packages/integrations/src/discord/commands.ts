// The bot's slash commands (docs/specs/m07 §4–5). Pure data in es-419; the bot
// process wires each name to a handler and the API/port registers them per guild.

import type { SlashCommand } from './ports.js';

export const DISCORD_COMMANDS = {
  checkin: 'checkin',
  proximo: 'proximo',
  tabla: 'tabla',
  perfil: 'perfil',
  equipo: 'equipo',
  vincular: 'vincular',
} as const;

export type DiscordCommandName = (typeof DISCORD_COMMANDS)[keyof typeof DISCORD_COMMANDS];

const STRING = 3 as const;
const USER = 6 as const;

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: DISCORD_COMMANDS.checkin, description: 'Haz check-in de tu próxima partida.' },
  { name: DISCORD_COMMANDS.proximo, description: 'Tu próxima partida programada.' },
  {
    name: DISCORD_COMMANDS.tabla,
    description: 'La tabla de posiciones de un torneo.',
    options: [
      {
        name: 'torneo',
        description: 'Nombre o identificador del torneo',
        type: STRING,
        required: true,
      },
    ],
  },
  {
    name: DISCORD_COMMANDS.perfil,
    description: 'El perfil de un jugador.',
    options: [
      {
        name: 'usuario',
        description: 'Jugador de Discord (o tú por defecto)',
        type: USER,
        required: false,
      },
    ],
  },
  {
    name: DISCORD_COMMANDS.equipo,
    description: 'El perfil de un equipo.',
    options: [{ name: 'nombre', description: 'Nombre del equipo', type: STRING, required: true }],
  },
  {
    name: DISCORD_COMMANDS.vincular,
    description: 'Vincula tu cuenta de Discord con la plataforma.',
  },
];
