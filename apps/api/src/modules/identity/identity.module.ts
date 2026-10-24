import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';

import { CLOCK, type Clock } from '../../shared/clock.js';
import { SUPABASE_ADMIN, type AdminClient } from '../../shared/database/supabase-admin.js';
import { IMAGE_STORAGE, type ImageStorage } from '../../shared/storage/image-storage.js';
import { RiotAccountQueries } from '../riot-accounts/application/riot-verification.use-cases.js';
import { RiotAccountsModule } from '../riot-accounts/riot-accounts.module.js';
import {
  ID_GENERATOR,
  PROFILE_REPOSITORY,
  RIOT_ACCOUNT_STATUS,
  type IdGenerator,
  type ProfileRepository,
  type RiotAccountStatus,
} from './application/ports.js';
import {
  GetMyProfileUseCase,
  GetPrivacyUseCase,
  GetPrivateDataUseCase,
  GetSocialLinksUseCase,
  ProfileQueries,
  SearchUsersUseCase,
  UpdatePrivacyUseCase,
  UpdatePrivateDataUseCase,
  UpdateProfileUseCase,
  UpdateSocialLinksUseCase,
  UploadAvatarUseCase,
} from './application/profile.use-cases.js';
import { SupabaseProfileRepository } from './infrastructure/supabase-profile-repository.js';
import { MeController } from './presentation/me.controller.js';
import { ProfileController, UsersController } from './presentation/profile.controller.js';

type Repo = ProfileRepository;

@Module({
  imports: [RiotAccountsModule],
  controllers: [MeController, ProfileController, UsersController],
  providers: [
    {
      provide: PROFILE_REPOSITORY,
      inject: [SUPABASE_ADMIN],
      useFactory: (db: AdminClient) => new SupabaseProfileRepository(db),
    },
    { provide: RIOT_ACCOUNT_STATUS, useExisting: RiotAccountQueries },
    { provide: ID_GENERATOR, useValue: randomUUID satisfies IdGenerator },
    {
      provide: GetMyProfileUseCase,
      inject: [PROFILE_REPOSITORY, RIOT_ACCOUNT_STATUS, IMAGE_STORAGE],
      useFactory: (repo: Repo, riot: RiotAccountStatus, storage: ImageStorage) =>
        new GetMyProfileUseCase(repo, riot, storage),
    },
    {
      provide: UpdateProfileUseCase,
      inject: [PROFILE_REPOSITORY, RIOT_ACCOUNT_STATUS, IMAGE_STORAGE],
      useFactory: (repo: Repo, riot: RiotAccountStatus, storage: ImageStorage) =>
        new UpdateProfileUseCase(repo, riot, storage),
    },
    {
      provide: UploadAvatarUseCase,
      inject: [PROFILE_REPOSITORY, IMAGE_STORAGE, ID_GENERATOR, RIOT_ACCOUNT_STATUS],
      useFactory: (
        repo: Repo,
        storage: ImageStorage,
        newId: IdGenerator,
        riot: RiotAccountStatus,
      ) => new UploadAvatarUseCase(repo, storage, newId, riot),
    },
    {
      provide: GetPrivateDataUseCase,
      inject: [PROFILE_REPOSITORY],
      useFactory: (repo: Repo) => new GetPrivateDataUseCase(repo),
    },
    {
      provide: UpdatePrivateDataUseCase,
      inject: [PROFILE_REPOSITORY, CLOCK],
      useFactory: (repo: Repo, clock: Clock) => new UpdatePrivateDataUseCase(repo, clock),
    },
    {
      provide: GetPrivacyUseCase,
      inject: [PROFILE_REPOSITORY],
      useFactory: (repo: Repo) => new GetPrivacyUseCase(repo),
    },
    {
      provide: UpdatePrivacyUseCase,
      inject: [PROFILE_REPOSITORY],
      useFactory: (repo: Repo) => new UpdatePrivacyUseCase(repo),
    },
    {
      provide: GetSocialLinksUseCase,
      inject: [PROFILE_REPOSITORY],
      useFactory: (repo: Repo) => new GetSocialLinksUseCase(repo),
    },
    {
      provide: UpdateSocialLinksUseCase,
      inject: [PROFILE_REPOSITORY],
      useFactory: (repo: Repo) => new UpdateSocialLinksUseCase(repo),
    },
    {
      provide: SearchUsersUseCase,
      inject: [PROFILE_REPOSITORY, IMAGE_STORAGE],
      useFactory: (repo: Repo, storage: ImageStorage) => new SearchUsersUseCase(repo, storage),
    },
    {
      provide: ProfileQueries,
      inject: [PROFILE_REPOSITORY, IMAGE_STORAGE],
      useFactory: (repo: Repo, storage: ImageStorage) => new ProfileQueries(repo, storage),
    },
  ],
  exports: [ProfileQueries],
})
export class IdentityModule {}
