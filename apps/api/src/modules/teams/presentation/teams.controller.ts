import {
  ChangeMemberRoleRequestSchema,
  CreateInvitationRequestSchema,
  CreateJoinRequestSchema,
  CreateTeamRequestSchema,
  DecideJoinRequestSchema,
  DissolveTeamRequestSchema,
  FreeAgentResponseSchema,
  IMAGE_UPLOAD,
  MyTeamSchema,
  ReceivedInvitationSchema,
  TeamDetailSchema,
  TeamInvitationSchema,
  TeamSummarySchema,
  TransferCaptaincyRequestSchema,
  UpdateFreeAgentRequestSchema,
  UpdateTeamRequestSchema,
  type FreeAgentResponse,
  type MyTeam,
  type ReceivedInvitation,
  type TeamDetail,
  type TeamInvitation,
  type TeamSummary,
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
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';

import type { UploadedImage } from '../../../shared/storage/image.js';
import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  AcceptInvitationUseCase,
  CancelCaptaincyTransferUseCase,
  ChangeMemberUseCase,
  CreateTeamUseCase,
  DeclineInvitationUseCase,
  DecideJoinRequestUseCase,
  DissolveTeamUseCase,
  GetFreeAgentUseCase,
  GetInvitationByCodeUseCase,
  GetTeamUseCase,
  InviteToTeamUseCase,
  LeaveTeamUseCase,
  ListMyInvitationsUseCase,
  ListMyTeamsUseCase,
  RemoveMemberUseCase,
  RequestCaptaincyTransferUseCase,
  RequestToJoinUseCase,
  RespondCaptaincyTransferUseCase,
  RevokeInvitationUseCase,
  UpdateFreeAgentUseCase,
  UpdateTeamUseCase,
  UploadTeamLogoUseCase,
} from '../application/teams.use-cases.js';

const uuid = new ParseUUIDPipe();
const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);
const CodeSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
const DecisionSchema = z.enum(['accept', 'decline']);

@Controller('teams')
@UseGuards(AccessTokenGuard)
export class TeamsController {
  constructor(
    @Inject(CreateTeamUseCase) private readonly createTeam: CreateTeamUseCase,
    @Inject(ListMyTeamsUseCase) private readonly listMine: ListMyTeamsUseCase,
    @Inject(GetTeamUseCase) private readonly getTeam: GetTeamUseCase,
    @Inject(UpdateTeamUseCase) private readonly updateTeam: UpdateTeamUseCase,
    @Inject(UploadTeamLogoUseCase) private readonly uploadLogo: UploadTeamLogoUseCase,
    @Inject(DissolveTeamUseCase) private readonly dissolveTeam: DissolveTeamUseCase,
    @Inject(InviteToTeamUseCase) private readonly invite: InviteToTeamUseCase,
    @Inject(RevokeInvitationUseCase) private readonly revoke: RevokeInvitationUseCase,
    @Inject(RequestToJoinUseCase) private readonly requestJoin: RequestToJoinUseCase,
    @Inject(DecideJoinRequestUseCase) private readonly decideJoin: DecideJoinRequestUseCase,
    @Inject(ChangeMemberUseCase) private readonly changeMember: ChangeMemberUseCase,
    @Inject(RemoveMemberUseCase) private readonly removeMember: RemoveMemberUseCase,
    @Inject(LeaveTeamUseCase) private readonly leaveTeam: LeaveTeamUseCase,
    @Inject(RequestCaptaincyTransferUseCase)
    private readonly requestTransfer: RequestCaptaincyTransferUseCase,
    @Inject(RespondCaptaincyTransferUseCase)
    private readonly respondTransfer: RespondCaptaincyTransferUseCase,
    @Inject(CancelCaptaincyTransferUseCase)
    private readonly cancelTransfer: CancelCaptaincyTransferUseCase,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown): Promise<TeamDetail> {
    return TeamDetailSchema.parse(
      await this.createTeam.execute(user.id, validate(CreateTeamRequestSchema, body)),
    );
  }

  @Get('mine')
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<MyTeam[]> {
    return MyTeamSchema.array().parse(await this.listMine.execute(user.id));
  }

  @Get('by-slug/:slug')
  async bySlug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ): Promise<TeamDetail> {
    return TeamDetailSchema.parse(await this.getTeam.execute(user.id, validate(SlugSchema, slug)));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<TeamDetail> {
    return TeamDetailSchema.parse(
      await this.updateTeam.execute(user.id, id, validate(UpdateTeamRequestSchema, body)),
    );
  }

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD.maxBytes, files: 1 } }),
  )
  async logo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<TeamDetail> {
    return TeamDetailSchema.parse(await this.uploadLogo.execute(user.id, id, file));
  }

  @Post(':id/dissolve')
  @HttpCode(204)
  async dissolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.dissolveTeam.execute(user.id, id, validate(DissolveTeamRequestSchema, body).reason);
  }

  @Post(':id/invitations')
  async createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<TeamInvitation> {
    return TeamInvitationSchema.parse(
      await this.invite.execute(user.id, id, validate(CreateInvitationRequestSchema, body)),
    );
  }

  @Delete(':id/invitations/:invitationId')
  @HttpCode(204)
  async revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('invitationId', uuid) invitationId: string,
  ): Promise<void> {
    await this.revoke.execute(user.id, id, invitationId);
  }

  @Post(':id/join-requests')
  async joinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<{ id: string }> {
    return this.requestJoin.execute(user.id, id, validate(CreateJoinRequestSchema, body ?? {}));
  }

  @Post(':id/join-requests/:requestId/decision')
  @HttpCode(200)
  async decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('requestId', uuid) requestId: string,
    @Body() body: unknown,
  ): Promise<TeamDetail> {
    return TeamDetailSchema.parse(
      await this.decideJoin.execute(
        user.id,
        id,
        requestId,
        validate(DecideJoinRequestSchema, body),
      ),
    );
  }

  @Patch(':id/members/:userId')
  async updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('userId', uuid) userId: string,
    @Body() body: unknown,
  ): Promise<TeamDetail> {
    return TeamDetailSchema.parse(
      await this.changeMember.execute(
        user.id,
        id,
        userId,
        validate(ChangeMemberRoleRequestSchema, body),
      ),
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  async deleteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('userId', uuid) userId: string,
  ): Promise<void> {
    await this.removeMember.execute(user.id, id, userId);
  }

  @Post(':id/leave')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.leaveTeam.execute(user.id, id);
  }

  @Post(':id/captaincy-transfer')
  @HttpCode(204)
  async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.requestTransfer.execute(user.id, id, validate(TransferCaptaincyRequestSchema, body));
  }

  @Post(':id/captaincy-transfer/:decision')
  @HttpCode(204)
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('decision') decision: string,
  ): Promise<void> {
    await this.respondTransfer.execute(user.id, id, validate(DecisionSchema, decision));
  }

  @Delete(':id/captaincy-transfer')
  @HttpCode(204)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.cancelTransfer.execute(user.id, id);
  }
}

@Controller('invitations')
@UseGuards(AccessTokenGuard)
export class InvitationsController {
  constructor(
    @Inject(ListMyInvitationsUseCase) private readonly listMine: ListMyInvitationsUseCase,
    @Inject(GetInvitationByCodeUseCase) private readonly byCode: GetInvitationByCodeUseCase,
    @Inject(AcceptInvitationUseCase) private readonly acceptInvitation: AcceptInvitationUseCase,
    @Inject(DeclineInvitationUseCase) private readonly declineInvitation: DeclineInvitationUseCase,
  ) {}

  @Get('mine')
  async mine(@CurrentUser() user: AuthenticatedUser): Promise<ReceivedInvitation[]> {
    return ReceivedInvitationSchema.array().parse(await this.listMine.execute(user.id));
  }

  @Get('code/:code')
  async preview(@Param('code') code: string): Promise<ReceivedInvitation> {
    return ReceivedInvitationSchema.parse(await this.byCode.execute(validate(CodeSchema, code)));
  }

  @Post('code/:code/accept')
  @HttpCode(200)
  async acceptCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ): Promise<TeamSummary> {
    return TeamSummarySchema.parse(
      await this.acceptInvitation.execute(user.id, { code: validate(CodeSchema, code) }),
    );
  }

  @Post(':id/accept')
  @HttpCode(200)
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<TeamSummary> {
    return TeamSummarySchema.parse(
      await this.acceptInvitation.execute(user.id, { invitationId: id }),
    );
  }

  @Post(':id/decline')
  @HttpCode(204)
  async decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.declineInvitation.execute(user.id, id);
  }
}

@Controller('me/free-agent')
@UseGuards(AccessTokenGuard)
export class FreeAgentController {
  constructor(
    @Inject(GetFreeAgentUseCase) private readonly getListing: GetFreeAgentUseCase,
    @Inject(UpdateFreeAgentUseCase) private readonly updateListing: UpdateFreeAgentUseCase,
  ) {}

  @Get()
  async get(@CurrentUser() user: AuthenticatedUser): Promise<FreeAgentResponse> {
    return FreeAgentResponseSchema.parse(await this.getListing.execute(user.id));
  }

  @Put()
  async put(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<FreeAgentResponse> {
    return FreeAgentResponseSchema.parse(
      await this.updateListing.execute(user.id, validate(UpdateFreeAgentRequestSchema, body)),
    );
  }
}
