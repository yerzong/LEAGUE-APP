import { TournamentBoardSchema, type TournamentBoard } from '@league/contracts';
import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import { GetAdminBoardUseCase, GetPublicBoardUseCase } from '../application/standings.use-cases.js';

const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(90);

@Controller('admin/tournaments')
@UseGuards(AccessTokenGuard)
export class AdminBoardController {
  constructor(@Inject(GetAdminBoardUseCase) private readonly board: GetAdminBoardUseCase) {}

  @Get(':id/board')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TournamentBoard> {
    return TournamentBoardSchema.parse(await this.board.execute(user.id, id));
  }
}

/** Bracket, tables and calendar of the public tournament page. */
@Controller('public/tournaments')
export class PublicBoardController {
  constructor(@Inject(GetPublicBoardUseCase) private readonly board: GetPublicBoardUseCase) {}

  @Get(':slug/board')
  async get(@Param('slug') slug: string): Promise<TournamentBoard> {
    return TournamentBoardSchema.parse(await this.board.execute(validate(SlugSchema, slug)));
  }
}
