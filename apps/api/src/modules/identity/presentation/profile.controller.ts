import {
  IMAGE_UPLOAD,
  PrivacySettingsSchema,
  PrivateDataResponseSchema,
  ProfileResponseSchema,
  SocialLinksResponseSchema,
  UpdatePrivateDataRequestSchema,
  UpdateProfileRequestSchema,
  UpdateSocialLinksRequestSchema,
  UserSearchQuerySchema,
  UserSearchResultSchema,
  type PrivacySettings,
  type PrivateDataResponse,
  type ProfileResponse,
  type UpdateSocialLinksRequest,
  type UserSearchResult,
} from '@league/contracts';
import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { UploadedImage } from '../../../shared/storage/image.js';
import { validate } from '../../../shared/validation.js';
import {
  GetMyProfileUseCase,
  GetPrivacyUseCase,
  GetPrivateDataUseCase,
  GetSocialLinksUseCase,
  SearchUsersUseCase,
  UpdatePrivacyUseCase,
  UpdatePrivateDataUseCase,
  UpdateProfileUseCase,
  UpdateSocialLinksUseCase,
  UploadAvatarUseCase,
} from '../application/profile.use-cases.js';
import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('me')
@UseGuards(AccessTokenGuard)
export class ProfileController {
  constructor(
    @Inject(GetMyProfileUseCase) private readonly getProfile: GetMyProfileUseCase,
    @Inject(UpdateProfileUseCase) private readonly updateProfile: UpdateProfileUseCase,
    @Inject(UploadAvatarUseCase) private readonly uploadAvatar: UploadAvatarUseCase,
    @Inject(GetPrivateDataUseCase) private readonly getPrivate: GetPrivateDataUseCase,
    @Inject(UpdatePrivateDataUseCase) private readonly updatePrivate: UpdatePrivateDataUseCase,
    @Inject(GetPrivacyUseCase) private readonly getPrivacy: GetPrivacyUseCase,
    @Inject(UpdatePrivacyUseCase) private readonly updatePrivacy: UpdatePrivacyUseCase,
    @Inject(GetSocialLinksUseCase) private readonly getLinks: GetSocialLinksUseCase,
    @Inject(UpdateSocialLinksUseCase) private readonly updateLinks: UpdateSocialLinksUseCase,
  ) {}

  @Get('profile')
  async profile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
    return ProfileResponseSchema.parse(await this.getProfile.execute(user.id));
  }

  @Put('profile')
  async saveProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<ProfileResponse> {
    const input = validate(UpdateProfileRequestSchema, body);
    return ProfileResponseSchema.parse(await this.updateProfile.execute(user.id, input));
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD.maxBytes, files: 1 } }),
  )
  async avatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<ProfileResponse> {
    return ProfileResponseSchema.parse(await this.uploadAvatar.execute(user.id, file));
  }

  @Get('private-data')
  async privateData(@CurrentUser() user: AuthenticatedUser): Promise<PrivateDataResponse> {
    return PrivateDataResponseSchema.parse(await this.getPrivate.execute(user.id));
  }

  @Put('private-data')
  async savePrivateData(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<PrivateDataResponse> {
    const input = validate(UpdatePrivateDataRequestSchema, body);
    return PrivateDataResponseSchema.parse(await this.updatePrivate.execute(user.id, input));
  }

  @Get('privacy')
  async privacy(@CurrentUser() user: AuthenticatedUser): Promise<PrivacySettings> {
    return PrivacySettingsSchema.parse(await this.getPrivacy.execute(user.id));
  }

  @Put('privacy')
  async savePrivacy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<PrivacySettings> {
    const input = validate(PrivacySettingsSchema, body);
    return PrivacySettingsSchema.parse(await this.updatePrivacy.execute(user.id, input));
  }

  @Get('social-links')
  async socialLinks(@CurrentUser() user: AuthenticatedUser): Promise<UpdateSocialLinksRequest> {
    return SocialLinksResponseSchema.parse(await this.getLinks.execute(user.id));
  }

  @Put('social-links')
  async saveSocialLinks(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ): Promise<UpdateSocialLinksRequest> {
    const input = validate(UpdateSocialLinksRequestSchema, body);
    return SocialLinksResponseSchema.parse(await this.updateLinks.execute(user.id, input));
  }
}

@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(@Inject(SearchUsersUseCase) private readonly searchUsers: SearchUsersUseCase) {}

  @Get('search')
  async search(@Query() query: unknown): Promise<UserSearchResult[]> {
    const { q } = validate(UserSearchQuerySchema, query);
    return UserSearchResultSchema.array().parse(await this.searchUsers.execute(q));
  }
}
