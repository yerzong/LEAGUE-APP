import {
  AdminNotificationTypeDetailSchema,
  AdminNotificationTypeSchema,
  DeliveryHistorySchema,
  DeliveryQuerySchema,
  InboxQuerySchema,
  InboxSchema,
  NotificationChannelSchema,
  NotificationPreferencesSchema,
  PreviewTemplateRequestSchema,
  SaveTemplateRequestSchema,
  TemplatePreviewSchema,
  UnreadCountSchema,
  UpdatePreferencesRequestSchema,
  UpdateRuleRequestSchema,
  type AdminNotificationType,
  type AdminNotificationTypeDetail,
  type DeliveryHistory,
  type Inbox,
  type NotificationPreferences,
  type TemplatePreview,
  type UnreadCount,
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { validate } from '../../../shared/validation.js';
import type { AuthenticatedUser } from '../../identity/domain/authenticated-user.js';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard.js';
import { CurrentUser } from '../../identity/presentation/current-user.decorator.js';
import {
  GetInboxUseCase,
  GetNotificationPreferencesUseCase,
  GetNotificationTypeUseCase,
  GetUnreadCountUseCase,
  ListDeliveriesUseCase,
  ListNotificationTypesUseCase,
  MarkNotificationReadUseCase,
  PreviewNotificationTemplateUseCase,
  ResetNotificationTemplateUseCase,
  SaveNotificationRuleUseCase,
  SaveNotificationTemplateUseCase,
  UpdateNotificationPreferencesUseCase,
} from '../application/notifications.use-cases.js';

const uuid = new ParseUUIDPipe();
const TypeKeySchema = z
  .string()
  .regex(/^[a-z_]+(\.[a-z_]+)+$/)
  .max(80);

/** Player portal: the bell, the inbox and the preferences. */
@Controller()
@UseGuards(AccessTokenGuard)
export class NotificationsController {
  constructor(
    @Inject(GetInboxUseCase) private readonly inbox: GetInboxUseCase,
    @Inject(GetUnreadCountUseCase) private readonly unread: GetUnreadCountUseCase,
    @Inject(MarkNotificationReadUseCase) private readonly markRead: MarkNotificationReadUseCase,
    @Inject(GetNotificationPreferencesUseCase)
    private readonly preferences: GetNotificationPreferencesUseCase,
    @Inject(UpdateNotificationPreferencesUseCase)
    private readonly updatePreferences: UpdateNotificationPreferencesUseCase,
  ) {}

  @Get('notifications')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<Inbox> {
    return InboxSchema.parse(await this.inbox.execute(user.id, validate(InboxQuerySchema, query)));
  }

  @Get('notifications/unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<UnreadCount> {
    return UnreadCountSchema.parse(await this.unread.execute(user.id));
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  async readAll(@CurrentUser() user: AuthenticatedUser): Promise<UnreadCount> {
    return UnreadCountSchema.parse(await this.markRead.execute(user.id, null));
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  async read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuid) id: string,
  ): Promise<UnreadCount> {
    return UnreadCountSchema.parse(await this.markRead.execute(user.id, id));
  }

  @Get('me/notification-preferences')
  async getPreferences(@CurrentUser() user: AuthenticatedUser): Promise<NotificationPreferences> {
    return NotificationPreferencesSchema.parse(await this.preferences.execute(user.id));
  }

  @Put('me/notification-preferences')
  async putPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<NotificationPreferences> {
    return NotificationPreferencesSchema.parse(
      await this.updatePreferences.execute(user.id, validate(UpdatePreferencesRequestSchema, body)),
    );
  }
}

/** Admin console: types, rules, templates and the delivery monitor (the use cases check staff). */
@Controller('admin/notifications')
@UseGuards(AccessTokenGuard)
export class AdminNotificationsController {
  constructor(
    @Inject(ListNotificationTypesUseCase) private readonly types: ListNotificationTypesUseCase,
    @Inject(GetNotificationTypeUseCase) private readonly type: GetNotificationTypeUseCase,
    @Inject(SaveNotificationRuleUseCase) private readonly saveRule: SaveNotificationRuleUseCase,
    @Inject(SaveNotificationTemplateUseCase)
    private readonly saveTemplate: SaveNotificationTemplateUseCase,
    @Inject(ResetNotificationTemplateUseCase)
    private readonly resetTemplate: ResetNotificationTemplateUseCase,
    @Inject(PreviewNotificationTemplateUseCase)
    private readonly preview: PreviewNotificationTemplateUseCase,
    @Inject(ListDeliveriesUseCase) private readonly deliveries: ListDeliveriesUseCase,
  ) {}

  @Get('types')
  async listTypes(@CurrentUser() user: AuthenticatedUser): Promise<AdminNotificationType[]> {
    return AdminNotificationTypeSchema.array().parse(await this.types.execute(user.id));
  }

  @Get('types/:key')
  async getType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<AdminNotificationTypeDetail> {
    return AdminNotificationTypeDetailSchema.parse(
      await this.type.execute(user.id, validate(TypeKeySchema, key)),
    );
  }

  @Put('types/:key/rule')
  async putRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() body: unknown,
  ): Promise<AdminNotificationTypeDetail> {
    return AdminNotificationTypeDetailSchema.parse(
      await this.saveRule.execute(
        user.id,
        validate(TypeKeySchema, key),
        validate(UpdateRuleRequestSchema, body),
      ),
    );
  }

  @Put('types/:key/templates/:channel')
  async putTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('channel') channel: string,
    @Body() body: unknown,
  ): Promise<AdminNotificationTypeDetail> {
    return AdminNotificationTypeDetailSchema.parse(
      await this.saveTemplate.execute(
        user.id,
        validate(TypeKeySchema, key),
        validate(NotificationChannelSchema, channel),
        validate(SaveTemplateRequestSchema, body),
      ),
    );
  }

  @Delete('types/:key/templates/:channel')
  async deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('channel') channel: string,
  ): Promise<AdminNotificationTypeDetail> {
    return AdminNotificationTypeDetailSchema.parse(
      await this.resetTemplate.execute(
        user.id,
        validate(TypeKeySchema, key),
        validate(NotificationChannelSchema, channel),
      ),
    );
  }

  @Post('templates/preview')
  @HttpCode(200)
  async previewTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<TemplatePreview> {
    return TemplatePreviewSchema.parse(
      await this.preview.execute(user.id, validate(PreviewTemplateRequestSchema, body)),
    );
  }

  @Get('deliveries')
  async listDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ): Promise<DeliveryHistory> {
    return DeliveryHistorySchema.parse(
      await this.deliveries.execute(user.id, validate(DeliveryQuerySchema, query)),
    );
  }
}
