import {
  PublicPlayerSchema,
  PublicTeamSchema,
  type PublicPlayer,
  type PublicTeam,
} from '@league/contracts';
import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { OptionalAccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { OptionalUser } from '../../identity/presentation/current-user.decorator.js';
import { GetPublicPlayerUseCase, GetPublicTeamUseCase } from '../application/public-pages.js';

const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);
const UsernameSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/);

/** Anonymous access; a signed-in viewer may see team-only fields. */
@Controller('public')
@UseGuards(OptionalAccessTokenGuard)
export class PublicController {
  constructor(
    @Inject(GetPublicTeamUseCase) private readonly team: GetPublicTeamUseCase,
    @Inject(GetPublicPlayerUseCase) private readonly player: GetPublicPlayerUseCase,
  ) {}

  @Get('teams/:slug')
  async getTeam(
    @Param('slug') slug: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<PublicTeam> {
    return PublicTeamSchema.parse(
      await this.team.execute(validate(SlugSchema, slug), viewer?.id ?? null),
    );
  }

  @Get('players/:username')
  async getPlayer(
    @Param('username') username: string,
    @OptionalUser() viewer: AuthenticatedUser | null,
  ): Promise<PublicPlayer> {
    return PublicPlayerSchema.parse(
      await this.player.execute(validate(UsernameSchema, username), viewer?.id ?? null),
    );
  }
}
