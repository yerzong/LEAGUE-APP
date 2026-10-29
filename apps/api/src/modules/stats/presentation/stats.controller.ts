import {
  AdminAchievementListSchema,
  AttachMatchDataRequestSchema,
  FollowListSchema,
  FollowRequestSchema,
  FollowStateSchema,
  HeadToHeadSchema,
  MatchStatsSchema,
  PlayerStatsSchema,
  RecalculateStatsResponseSchema,
  SaveAchievementRequestSchema,
  TeamStatsSchema,
  TournamentStatsSchema,
  type AdminAchievementList,
  type FollowList,
  type FollowState,
  type HeadToHead,
  type MatchStats,
  type PlayerStats,
  type RecalculateStatsResponse,
  type TeamStats,
  type TournamentStats,
} from '@league/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import {
  AccessTokenGuard,
  OptionalAccessTokenGuard,
} from '../../identity/presentation/access-token.guard.js';
import { CurrentUser, OptionalUser } from '../../identity/presentation/current-user.decorator.js';
import {
  AttachGameDataUseCase,
  FollowUseCase,
  GetHeadToHeadUseCase,
  GetMatchStatsUseCase,
  GetPlayerStatsUseCase,
  GetTeamStatsUseCase,
  GetTournamentStatsUseCase,
  ListAchievementsUseCase,
  ListMyFollowsUseCase,
  RecalculateTournamentStatsUseCase,
  SaveAchievementUseCase,
  UnfollowUseCase,
} from '../application/stats.use-cases.js';

const uuid = new ParseUUIDPipe();
const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);
const UsernameSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);
const AchievementKeySchema = z.string().regex(/^[a-z0-9_]{3,40}$/);

/** Public stats: anonymous access; a signed-in viewer also learns whether they follow. */
@Controller('public')
@UseGuards(OptionalAccessTokenGuard)
export class PublicStatsController {
  constructor(
    @Inject(GetPlayerStatsUseCase) private readonly player: GetPlayerStatsUseCase,
    @Inject(GetHeadToHeadUseCase) private readonly h2h: GetHeadToHeadUseCase,
    @Inject(GetTeamStatsUseCase) private readonly team: GetTeamStatsUseCase,
    @Inject(GetTournamentStatsUseCase) private readonly tournament: GetTournamentStatsUseCase,
    @Inject(GetMatchStatsUseCase) private readonly match: GetMatchStatsUseCase,
  ) {}

  @Get('players/:username/stats')
  async playerStats(
    @Param('username') username: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<PlayerStats> {
    return PlayerStatsSchema.parse(
      await this.player.execute(validate(UsernameSchema, username), viewer?.id ?? null),
    );
  }

  @Get('players/:username/vs/:other')
  async headToHead(
    @Param('username') username: string,
    @Param('other') other: string,
  ): Promise<HeadToHead> {
    return HeadToHeadSchema.parse(
      await this.h2h.execute(validate(UsernameSchema, username), validate(UsernameSchema, other)),
    );
  }

  @Get('teams/:slug/stats')
  async teamStats(
    @Param('slug') slug: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<TeamStats> {
    return TeamStatsSchema.parse(
      await this.team.execute(validate(SlugSchema, slug), viewer?.id ?? null),
    );
  }

  @Get('tournaments/:slug/stats')
  async tournamentStats(
    @Param('slug') slug: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<TournamentStats> {
    return TournamentStatsSchema.parse(
      await this.tournament.execute(validate(SlugSchema, slug), viewer?.id ?? null),
    );
  }

  @Get('matches/:id/stats')
  async matchStats(@Param('id', uuid) id: string): Promise<MatchStats> {
    return MatchStatsSchema.parse(await this.match.execute(id));
  }
}

/** The signed-in user's follows (who follows whom is never public). */
@Controller('me/follows')
@UseGuards(AccessTokenGuard)
export class FollowsController {
  constructor(
    @Inject(FollowUseCase) private readonly followUseCase: FollowUseCase,
    @Inject(UnfollowUseCase) private readonly unfollowUseCase: UnfollowUseCase,
    @Inject(ListMyFollowsUseCase) private readonly listUseCase: ListMyFollowsUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<FollowList> {
    return FollowListSchema.parse(await this.listUseCase.execute(user.id));
  }

  @Post()
  @HttpCode(200)
  async follow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<FollowState> {
    return FollowStateSchema.parse(
      await this.followUseCase.execute(user.id, validate(FollowRequestSchema, body)),
    );
  }

  @Delete()
  async unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<FollowState> {
    return FollowStateSchema.parse(
      await this.unfollowUseCase.execute(user.id, validate(FollowRequestSchema, body)),
    );
  }
}

/** Staff: match data, recalculation and achievement rules. */
@Controller('admin')
@UseGuards(AccessTokenGuard)
export class AdminStatsController {
  constructor(
    @Inject(AttachGameDataUseCase) private readonly attach: AttachGameDataUseCase,
    @Inject(RecalculateTournamentStatsUseCase)
    private readonly recalculate: RecalculateTournamentStatsUseCase,
    @Inject(ListAchievementsUseCase) private readonly achievements: ListAchievementsUseCase,
    @Inject(SaveAchievementUseCase) private readonly saveAchievement: SaveAchievementUseCase,
  ) {}

  @Put('games/:gameId/match-data')
  @HttpCode(204)
  async attachMatchData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('gameId', uuid) gameId: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.attach.execute(user.id, gameId, validate(AttachMatchDataRequestSchema, body));
  }

  @Post('tournaments/:id/stats/recalculate')
  @HttpCode(200)
  async recalculateTournament(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<RecalculateStatsResponse> {
    return RecalculateStatsResponseSchema.parse(await this.recalculate.execute(user.id, id));
  }

  @Get('achievements')
  async listAchievements(@CurrentUser() user: AuthenticatedUser): Promise<AdminAchievementList> {
    return AdminAchievementListSchema.parse(await this.achievements.execute(user.id));
  }

  @Put('achievements/:key')
  @HttpCode(204)
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.saveAchievement.execute(
      user.id,
      validate(AchievementKeySchema, key),
      validate(SaveAchievementRequestSchema, body),
    );
  }
}
