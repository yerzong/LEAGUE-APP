import {
  MyRiotAccountResponseSchema,
  RiotAccountResponseSchema,
  RiotVerificationResponseSchema,
  StartRiotVerificationRequestSchema,
  UnlinkRiotAccountRequestSchema,
  type MyRiotAccountResponse,
  type RiotAccountResponse,
  type RiotVerificationResponse,
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
  UseGuards,
} from '@nestjs/common';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  ConfirmRiotVerificationUseCase,
  GetMyRiotAccountUseCase,
  StartRiotVerificationUseCase,
  UnlinkRiotAccountUseCase,
} from '../application/riot-verification.use-cases.js';

@Controller('me/riot-account')
@UseGuards(AccessTokenGuard)
export class RiotAccountController {
  constructor(
    @Inject(GetMyRiotAccountUseCase) private readonly getMine: GetMyRiotAccountUseCase,
    @Inject(StartRiotVerificationUseCase) private readonly start: StartRiotVerificationUseCase,
    @Inject(ConfirmRiotVerificationUseCase)
    private readonly confirm: ConfirmRiotVerificationUseCase,
    @Inject(UnlinkRiotAccountUseCase) private readonly unlink: UnlinkRiotAccountUseCase,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<MyRiotAccountResponse> {
    return MyRiotAccountResponseSchema.parse(await this.getMine.execute(user.id));
  }

  @Post('verifications')
  async startVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<RiotVerificationResponse> {
    const input = validate(StartRiotVerificationRequestSchema, body);
    return RiotVerificationResponseSchema.parse(await this.start.execute(user.id, input));
  }

  @Post('verifications/:id/confirm')
  @HttpCode(200)
  async confirmVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RiotAccountResponse> {
    return RiotAccountResponseSchema.parse(await this.confirm.execute(user.id, id));
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<void> {
    const { reason } = validate(UnlinkRiotAccountRequestSchema, body);
    await this.unlink.execute(user.id, reason);
  }
}
