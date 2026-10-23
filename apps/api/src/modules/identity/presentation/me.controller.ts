import { type MeResponse, MeResponseSchema } from '@league/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('me')
@UseGuards(AccessTokenGuard)
export class MeController {
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): MeResponse {
    return MeResponseSchema.parse(user);
  }
}
