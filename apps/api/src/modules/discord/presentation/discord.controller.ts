import {
  BotCheckinRequestSchema,
  BotNextMatchRequestSchema,
  BotPlayerRequestSchema,
  BotStandingsRequestSchema,
  BotTeamRequestSchema,
  BotReplySchema,
  DiscordConfigSchema,
  SaveDiscordGuildRequestSchema,
  SetDiscordChannelRequestSchema,
  type BotReply,
  type DiscordConfig,
} from '@league/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, Put, UseGuards } from '@nestjs/common';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import type { DiscordDeps } from '../application/deps.js';
import { DISCORD_DEPS } from '../application/deps.js';
import {
  BotCheckinUseCase,
  BotLinkUseCase,
  BotNextMatchUseCase,
  BotPlayerUseCase,
  BotStandingsUseCase,
  BotTeamUseCase,
  GetDiscordConfigUseCase,
  requireStaff,
  SaveDiscordGuildUseCase,
  SetDiscordChannelUseCase,
} from '../application/discord.use-cases.js';
import { BotSecretGuard } from './bot-secret.guard.js';

/** Admin console: connect the guild and map channels. Super admin only. */
@Controller('admin/discord')
@UseGuards(AccessTokenGuard)
export class AdminDiscordController {
  constructor(
    @Inject(DISCORD_DEPS) private readonly deps: DiscordDeps,
    @Inject(GetDiscordConfigUseCase) private readonly config: GetDiscordConfigUseCase,
    @Inject(SaveDiscordGuildUseCase) private readonly saveGuild: SaveDiscordGuildUseCase,
    @Inject(SetDiscordChannelUseCase) private readonly setChannel: SetDiscordChannelUseCase,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<DiscordConfig> {
    await requireStaff(this.deps, user.id);
    return DiscordConfigSchema.parse(await this.config.execute());
  }

  @Put()
  @HttpCode(200)
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<DiscordConfig> {
    await requireStaff(this.deps, user.id);
    await this.saveGuild.execute(user.id, validate(SaveDiscordGuildRequestSchema, body));
    return DiscordConfigSchema.parse(await this.config.execute());
  }

  @Put('channel')
  @HttpCode(200)
  async channel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<DiscordConfig> {
    await requireStaff(this.deps, user.id);
    await this.setChannel.execute(user.id, validate(SetDiscordChannelRequestSchema, body));
    return DiscordConfigSchema.parse(await this.config.execute());
  }
}

/** Bot process: the slash commands. Authenticated by the shared bot secret. */
@Controller('bot')
@UseGuards(BotSecretGuard)
export class BotController {
  constructor(
    @Inject(BotNextMatchUseCase) private readonly nextMatch: BotNextMatchUseCase,
    @Inject(BotCheckinUseCase) private readonly checkin: BotCheckinUseCase,
    @Inject(BotStandingsUseCase) private readonly standings: BotStandingsUseCase,
    @Inject(BotPlayerUseCase) private readonly player: BotPlayerUseCase,
    @Inject(BotTeamUseCase) private readonly team: BotTeamUseCase,
    @Inject(BotLinkUseCase) private readonly link: BotLinkUseCase,
  ) {}

  @Post('next-match')
  @HttpCode(200)
  async next(@Body() body: unknown): Promise<BotReply> {
    const { discordUserId } = validate(BotNextMatchRequestSchema, body);
    return BotReplySchema.parse(await this.nextMatch.execute(discordUserId));
  }

  @Post('checkin')
  @HttpCode(200)
  async check(@Body() body: unknown): Promise<BotReply> {
    const { discordUserId } = validate(BotCheckinRequestSchema, body);
    return BotReplySchema.parse(await this.checkin.execute(discordUserId));
  }

  @Post('standings')
  @HttpCode(200)
  async table(@Body() body: unknown): Promise<BotReply> {
    const { tournament } = validate(BotStandingsRequestSchema, body);
    return BotReplySchema.parse(await this.standings.execute(tournament));
  }

  @Post('player')
  @HttpCode(200)
  async profile(@Body() body: unknown): Promise<BotReply> {
    const { discordUserId, targetDiscordUserId } = validate(BotPlayerRequestSchema, body);
    return BotReplySchema.parse(await this.player.execute(discordUserId, targetDiscordUserId));
  }

  @Post('team')
  @HttpCode(200)
  async teamProfile(@Body() body: unknown): Promise<BotReply> {
    const { name } = validate(BotTeamRequestSchema, body);
    return BotReplySchema.parse(await this.team.execute(name));
  }

  @Post('link')
  @HttpCode(200)
  async vincular(@Body() body: unknown): Promise<BotReply> {
    const { discordUserId } = validate(BotNextMatchRequestSchema, body);
    return BotReplySchema.parse(await this.link.execute(discordUserId));
  }
}
