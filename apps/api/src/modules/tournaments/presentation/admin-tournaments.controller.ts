import {
  AuditEntrySchema,
  CreateTemplateRequestSchema,
  CreateTournamentRequestSchema,
  IMAGE_UPLOAD,
  RulebookDraftRequestSchema,
  TournamentActionRequestSchema,
  TournamentActionSchema,
  TournamentDetailSchema,
  TournamentSummarySchema,
  TournamentTemplateSchema,
  UpdateTournamentRequestSchema,
  type AuditEntry,
  type TournamentDetail,
  type TournamentSummary,
  type TournamentTemplate,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { UploadedImage } from '../../../shared/storage/image.js';
import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  CreateTemplateUseCase,
  CreateTournamentUseCase,
  DeleteTemplateUseCase,
  GetTemplateUseCase,
  GetTournamentAuditUseCase,
  GetTournamentUseCase,
  ListTemplatesUseCase,
  ListTournamentsUseCase,
  PublishRulebookVersionUseCase,
  RunTournamentActionUseCase,
  SaveRulebookDraftUseCase,
  UpdateTournamentUseCase,
  UploadTournamentCoverUseCase,
} from '../application/tournaments.use-cases.js';

const uuid = new ParseUUIDPipe();

/** Staff console (the use cases check the staff role). */
@Controller('admin/tournaments')
@UseGuards(AccessTokenGuard)
export class AdminTournamentsController {
  constructor(
    @Inject(ListTournamentsUseCase) private readonly listTournaments: ListTournamentsUseCase,
    @Inject(CreateTournamentUseCase) private readonly createTournament: CreateTournamentUseCase,
    @Inject(GetTournamentUseCase) private readonly getTournament: GetTournamentUseCase,
    @Inject(UpdateTournamentUseCase) private readonly updateTournament: UpdateTournamentUseCase,
    @Inject(UploadTournamentCoverUseCase)
    private readonly uploadCover: UploadTournamentCoverUseCase,
    @Inject(RunTournamentActionUseCase) private readonly runAction: RunTournamentActionUseCase,
    @Inject(SaveRulebookDraftUseCase) private readonly saveRulebook: SaveRulebookDraftUseCase,
    @Inject(PublishRulebookVersionUseCase)
    private readonly publishRulebook: PublishRulebookVersionUseCase,
    @Inject(GetTournamentAuditUseCase) private readonly getAudit: GetTournamentAuditUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<TournamentSummary[]> {
    return TournamentSummarySchema.array().parse(await this.listTournaments.execute(user.id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(
      await this.createTournament.execute(user.id, validate(CreateTournamentRequestSchema, body)),
    );
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(await this.getTournament.execute(user.id, id));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(
      await this.updateTournament.execute(
        user.id,
        id,
        validate(UpdateTournamentRequestSchema, body),
      ),
    );
  }

  @Post(':id/cover')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD.maxBytes, files: 1 } }),
  )
  async cover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(await this.uploadCover.execute(user.id, id, file));
  }

  @Post(':id/actions/:action')
  @HttpCode(200)
  async action(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Param('action') action: string,
    @Body() body: unknown,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(
      await this.runAction.execute(
        user.id,
        id,
        validate(TournamentActionSchema, action),
        validate(TournamentActionRequestSchema, body ?? {}),
      ),
    );
  }

  @Put(':id/rulebook')
  async rulebook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
    @Body() body: unknown,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(
      await this.saveRulebook.execute(user.id, id, validate(RulebookDraftRequestSchema, body)),
    );
  }

  @Post(':id/rulebook/publish')
  @HttpCode(200)
  async publishRulebookVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<TournamentDetail> {
    return TournamentDetailSchema.parse(await this.publishRulebook.execute(user.id, id));
  }

  @Get(':id/audit')
  async audit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<AuditEntry[]> {
    return AuditEntrySchema.array().parse(await this.getAudit.execute(user.id, id));
  }
}

@Controller('admin/tournament-templates')
@UseGuards(AccessTokenGuard)
export class AdminTemplatesController {
  constructor(
    @Inject(ListTemplatesUseCase) private readonly listTemplates: ListTemplatesUseCase,
    @Inject(GetTemplateUseCase) private readonly getTemplate: GetTemplateUseCase,
    @Inject(CreateTemplateUseCase) private readonly createTemplate: CreateTemplateUseCase,
    @Inject(DeleteTemplateUseCase) private readonly deleteTemplate: DeleteTemplateUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<TournamentTemplate[]> {
    return TournamentTemplateSchema.array().parse(await this.listTemplates.execute(user.id));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<TournamentTemplate> {
    return TournamentTemplateSchema.parse(await this.getTemplate.execute(user.id, id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<TournamentTemplate> {
    return TournamentTemplateSchema.parse(
      await this.createTemplate.execute(user.id, validate(CreateTemplateRequestSchema, body)),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.deleteTemplate.execute(user.id, id);
  }
}
