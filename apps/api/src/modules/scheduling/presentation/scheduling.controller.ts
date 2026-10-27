import {
  DecideRescheduleRequestSchema,
  MatchDetailSchema,
  RescheduleRequestSchema,
  RespondRescheduleRequestSchema,
  SetScheduleRequestSchema,
  type MatchDetail,
} from '@league/contracts';
import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  AutoScheduleUseCase,
  DecideRescheduleUseCase,
  RequestRescheduleUseCase,
  RespondRescheduleUseCase,
  SetScheduleUseCase,
} from '../application/scheduling.use-cases.js';

const uuid = new ParseUUIDPipe();

@Controller()
@UseGuards(AccessTokenGuard)
export class SchedulingController {
  constructor(
    @Inject(AutoScheduleUseCase) private readonly auto: AutoScheduleUseCase,
    @Inject(SetScheduleUseCase) private readonly setSchedule: SetScheduleUseCase,
    @Inject(RequestRescheduleUseCase) private readonly request: RequestRescheduleUseCase,
    @Inject(RespondRescheduleUseCase) private readonly respond: RespondRescheduleUseCase,
    @Inject(DecideRescheduleUseCase) private readonly decide: DecideRescheduleUseCase,
  ) {}

  @Post('admin/tournaments/:id/schedule')
  @HttpCode(200)
  async autoSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<{ scheduled: number }> {
    return this.auto.execute(user.id, id);
  }

  @Post('admin/matches/:id/schedule')
  @HttpCode(200)
  async schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.setSchedule.execute(user.id, id, validate(SetScheduleRequestSchema, body)),
    );
  }

  @Post('matches/:id/reschedules')
  @HttpCode(200)
  async requestReschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.request.execute(user.id, id, validate(RescheduleRequestSchema, body)),
    );
  }

  @Post('reschedules/:id/response')
  @HttpCode(200)
  async respondReschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.respond.execute(user.id, id, validate(RespondRescheduleRequestSchema, body)),
    );
  }

  @Post('admin/reschedules/:id/decision')
  @HttpCode(200)
  async decideReschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.decide.execute(user.id, id, validate(DecideRescheduleRequestSchema, body)),
    );
  }
}
