import {
  PublicTournamentDetailSchema,
  PublicTournamentListSchema,
  PublicTournamentQuerySchema,
  type PublicTournamentDetail,
  type PublicTournamentList,
} from '@league/contracts';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { validate } from '../../../shared/validation.js';
import {
  GetPublicTournamentUseCase,
  ListPublicTournamentsUseCase,
} from '../application/public-tournaments.js';

const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(90);

/** Anonymous: the same for every viewer. */
@Controller('public/tournaments')
export class PublicTournamentsController {
  constructor(
    @Inject(ListPublicTournamentsUseCase) private readonly list: ListPublicTournamentsUseCase,
    @Inject(GetPublicTournamentUseCase) private readonly get: GetPublicTournamentUseCase,
  ) {}

  @Get()
  async listTournaments(@Query() query: unknown): Promise<PublicTournamentList> {
    return PublicTournamentListSchema.parse(
      await this.list.execute(validate(PublicTournamentQuerySchema, query)),
    );
  }

  @Get(':slug')
  async getTournament(@Param('slug') slug: string): Promise<PublicTournamentDetail> {
    return PublicTournamentDetailSchema.parse(await this.get.execute(validate(SlugSchema, slug)));
  }
}
