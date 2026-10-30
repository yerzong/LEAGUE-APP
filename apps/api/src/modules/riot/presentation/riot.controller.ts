import {
  ConnectRiotResponseSchema,
  GenerateCodeRequestSchema,
  MatchCodesSchema,
  RiotCallbackAckSchema,
  RiotCallbackSchema,
  RiotIntegrationStatusSchema,
  type ConnectRiotResponse,
  type MatchCodes,
  type RiotCallbackAck,
  type RiotIntegrationStatus,
} from '@league/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { forbidden } from '../../../shared/application-error.js';
import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { ProfileQueries } from '../../identity/application/profile.use-cases.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  ConnectRiotUseCase,
  GenerateCodeUseCase,
  GetMatchCodesUseCase,
  GetMyMatchCodesUseCase,
  GetRiotStatusUseCase,
  ProcessRiotCallbackUseCase,
} from '../application/riot.use-cases.js';
import { RiotCallbackGuard } from './riot-callback.guard.js';

const uuid = new ParseUUIDPipe();

/** Riot's result callback. Authenticated by the shared callback secret. */
@Controller('integrations/riot')
@UseGuards(RiotCallbackGuard)
export class RiotWebhookController {
  constructor(
    @Inject(ProcessRiotCallbackUseCase) private readonly process: ProcessRiotCallbackUseCase,
  ) {}

  @Post('callbacks')
  @HttpCode(200)
  async callback(@Body() body: unknown): Promise<RiotCallbackAck> {
    return RiotCallbackAckSchema.parse(
      await this.process.execute(validate(RiotCallbackSchema, body)),
    );
  }
}

/** Admin: connect a tournament to Riot, see the status and (re)generate codes. */
@Controller('admin/riot')
@UseGuards(AccessTokenGuard)
export class AdminRiotController {
  constructor(
    @Inject(ProfileQueries) private readonly profiles: ProfileQueries,
    @Inject(ConnectRiotUseCase) private readonly connect: ConnectRiotUseCase,
    @Inject(GetRiotStatusUseCase) private readonly status: GetRiotStatusUseCase,
    @Inject(GenerateCodeUseCase) private readonly generate: GenerateCodeUseCase,
    @Inject(GetMatchCodesUseCase) private readonly codes: GetMatchCodesUseCase,
  ) {}

  private async requireStaff(userId: string): Promise<void> {
    const profile = await this.profiles.findById(userId);
    if (profile?.platformRole !== 'super_admin') throw forbidden('staff_only');
  }

  @Get('tournaments/:id/status')
  async getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<RiotIntegrationStatus> {
    await this.requireStaff(user.id);
    return RiotIntegrationStatusSchema.parse(await this.status.execute(id));
  }

  @Post('tournaments/:id/connect')
  @HttpCode(200)
  async connectTournament(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<ConnectRiotResponse> {
    await this.requireStaff(user.id);
    return ConnectRiotResponseSchema.parse(await this.connect.execute(user.id, id));
  }

  @Post('matches/:id/code')
  @HttpCode(200)
  async generateCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<{ code: string }> {
    await this.requireStaff(user.id);
    return this.generate.execute(id, validate(GenerateCodeRequestSchema, body));
  }

  @Get('matches/:id/codes')
  async matchCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<MatchCodes> {
    await this.requireStaff(user.id);
    return MatchCodesSchema.parse(await this.codes.execute(id));
  }
}

/** Player portal: the captain sees the codes for their own match. */
@Controller('matches')
@UseGuards(AccessTokenGuard)
export class PlayerRiotController {
  constructor(@Inject(GetMyMatchCodesUseCase) private readonly codes: GetMyMatchCodesUseCase) {}

  @Get(':id/riot-codes')
  async myCodes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<MatchCodes> {
    return MatchCodesSchema.parse(await this.codes.execute(user.id, id));
  }
}
