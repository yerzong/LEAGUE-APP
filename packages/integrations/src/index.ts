export * from './riot/ports.js';
export {
  RiotApiAccountAdapter,
  type RiotApiAccountAdapterOptions,
} from './riot/riot-api-adapter.js';
export {
  BASE_ICON_COUNT,
  StubRiotAccountAdapter,
  type StubAccount,
  type StubRiotAccountAdapterOptions,
} from './riot/stub-riot-account-adapter.js';
export * from './email/ports.js';
export { emailHtml, escapeHtml } from './email/layout.js';
export { FakeEmailAdapter } from './email/fake-email-adapter.js';
export {
  ResendEmailAdapter,
  type ResendEmailAdapterOptions,
} from './email/resend-email-adapter.js';
export {
  normalizeMatchV5,
  type MatchV5Payload,
  type NormalizedMatch,
  type NormalizedParticipant,
  type NormalizedRole,
  type NormalizedSide,
  type NormalizedTeam,
} from './riot/match-v5.js';
export {
  DataDragonChampionCatalog,
  StaticChampionCatalog,
  type ChampionCatalogPort,
  type ChampionInfo,
  type DataDragonOptions,
} from './riot/data-dragon.js';
export {
  DiscordError,
  type DiscordEmbed,
  type DiscordMessage,
  type DiscordPort,
  type SlashCommand,
  type SlashCommandOption,
  type TempVoiceChannel,
} from './discord/ports.js';
export {
  DEFAULT_BRAND_COLOR,
  nextMatchEmbed,
  notificationMessage,
  playerEmbed,
  standingsEmbed,
  teamEmbed,
  type EmbedTheme,
  type MatchEmbedInput,
  type PlayerEmbedInput,
  type StandingRow,
  type TeamEmbedInput,
} from './discord/embeds.js';
export { DISCORD_COMMANDS, SLASH_COMMANDS, type DiscordCommandName } from './discord/commands.js';
export { DiscordRestAdapter, type DiscordRestOptions } from './discord/rest-adapter.js';
export {
  FakeDiscordAdapter,
  type CreatedChannel,
  type RoleChange,
  type SentChannelMessage,
  type SentDirectMessage,
} from './discord/fake-discord-adapter.js';
export type {
  GenerateCodesParams,
  MatchDataPort,
  TeamSize,
  TournamentCallback,
  TournamentMapType,
  TournamentPickType,
  TournamentProviderPort,
  TournamentSpectatorType,
} from './riot/tournament-ports.js';
export {
  RiotTournamentAdapter,
  type RiotTournamentAdapterOptions,
} from './riot/riot-tournament-adapter.js';
export {
  RiotStubTournamentAdapter,
  type StubTournamentOptions,
} from './riot/stub-tournament-adapter.js';
