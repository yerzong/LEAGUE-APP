import {
  DisputeEvidenceRequestSchema,
  MatchActionSchema,
  MatchDetailSchema,
  MyMatchSchema,
  OpenDisputeRequestSchema,
  ReportResultRequestSchema,
  ResolveDisputeRequestSchema,
  StaffForfeitRequestSchema,
  StaffResultRequestSchema,
  type MatchDetail,
  type MyMatch,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { UploadedImage } from '../../../shared/storage/image.js';
import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import {
  AccessTokenGuard,
  OptionalAccessTokenGuard,
} from '../../identity/presentation/access-token.guard.js';
import { CurrentUser, OptionalUser } from '../../identity/presentation/current-user.decorator.js';
import {
  AddDisputeEvidenceUseCase,
  CheckInUseCase,
  GenerateFixturesUseCase,
  GetMatchUseCase,
  ListMyMatchesUseCase,
  OpenDisputeUseCase,
  ReportResultUseCase,
  ResolveDisputeUseCase,
  RunMatchActionUseCase,
  StaffForfeitUseCase,
  StaffResultUseCase,
  UploadEvidenceUseCase,
} from '../application/matches.use-cases.js';

const uuid = new ParseUUIDPipe();
const evidenceUpload = FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

/** Match center of the portal: the parties check in, report and dispute. */
@Controller()
@UseGuards(AccessTokenGuard)
export class MatchesController {
  constructor(
    @Inject(ListMyMatchesUseCase) private readonly listMine: ListMyMatchesUseCase,
    @Inject(GetMatchUseCase) private readonly getMatch: GetMatchUseCase,
    @Inject(CheckInUseCase) private readonly checkIn: CheckInUseCase,
    @Inject(ReportResultUseCase) private readonly report: ReportResultUseCase,
    @Inject(UploadEvidenceUseCase) private readonly uploadEvidence: UploadEvidenceUseCase,
    @Inject(OpenDisputeUseCase) private readonly openDispute: OpenDisputeUseCase,
    @Inject(AddDisputeEvidenceUseCase) private readonly addEvidence: AddDisputeEvidenceUseCase,
  ) {}

  @Get('matches/mine')
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<MyMatch[]> {
    return MyMatchSchema.array().parse(await this.listMine.execute(user.id));
  }

  @Get('matches/:id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(await this.getMatch.execute(user.id, id));
  }

  @Post('matches/:id/checkin')
  @HttpCode(200)
  async checkin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(await this.checkIn.execute(user.id, id));
  }

  @Post('matches/:id/report')
  @HttpCode(200)
  async reportResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.report.execute(user.id, id, validate(ReportResultRequestSchema, body)),
    );
  }

  @Post('matches/:id/evidence')
  @UseInterceptors(evidenceUpload)
  async evidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<{ path: string }> {
    return this.uploadEvidence.execute(user.id, id, file);
  }

  @Post('matches/:id/disputes')
  @HttpCode(200)
  async dispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.openDispute.execute(user.id, id, validate(OpenDisputeRequestSchema, body)),
    );
  }

  @Post('disputes/:id/evidence')
  @HttpCode(200)
  async disputeEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.addEvidence.execute(user.id, id, validate(DisputeEvidenceRequestSchema, body)),
    );
  }
}

/** Staff console (the use cases check the staff role). */
@Controller('admin')
@UseGuards(AccessTokenGuard)
export class AdminMatchesController {
  constructor(
    @Inject(GenerateFixturesUseCase) private readonly generate: GenerateFixturesUseCase,
    @Inject(RunMatchActionUseCase) private readonly runAction: RunMatchActionUseCase,
    @Inject(StaffResultUseCase) private readonly staffResult: StaffResultUseCase,
    @Inject(StaffForfeitUseCase) private readonly staffForfeit: StaffForfeitUseCase,
    @Inject(ResolveDisputeUseCase) private readonly resolve: ResolveDisputeUseCase,
  ) {}

  @Post('tournaments/:id/fixtures')
  @HttpCode(204)
  async fixtures(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.generate.execute(user.id, id);
  }

  @Post('matches/:id/actions/:action')
  @HttpCode(200)
  async action(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('action') action: string,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.runAction.execute(user.id, id, validate(MatchActionSchema, action)),
    );
  }

  @Post('matches/:id/result')
  @HttpCode(200)
  async result(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.staffResult.execute(user.id, id, validate(StaffResultRequestSchema, body)),
    );
  }

  @Post('matches/:id/forfeit')
  @HttpCode(200)
  async forfeit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.staffForfeit.execute(user.id, id, validate(StaffForfeitRequestSchema, body)),
    );
  }

  @Post('disputes/:id/resolve')
  @HttpCode(200)
  async resolveDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(
      await this.resolve.execute(user.id, id, validate(ResolveDisputeRequestSchema, body)),
    );
  }
}

/** Public match page: score per game and participants (same for every viewer). */
@Controller('public/matches')
@UseGuards(OptionalAccessTokenGuard)
export class PublicMatchesController {
  constructor(@Inject(GetMatchUseCase) private readonly getMatch: GetMatchUseCase) {}

  @Get(':id')
  async get(
    @Param('id', uuid) id: string,
    @OptionalUser() _viewer: AuthenticatedUser | null,
  ): Promise<MatchDetail> {
    return MatchDetailSchema.parse(await this.getMatch.execute(null, id));
  }
}
