import type {
  PrivacySettings,
  PrivateDataResponse,
  ProfileResponse,
  UpdatePrivateDataRequest,
  UpdateProfileRequest,
  UpdateSocialLinksRequest,
  UserSearchResult,
} from '@league/contracts';

import { conflict, notFound } from '../../../shared/application-error.js';
import type { Clock } from '../../../shared/clock.js';
import type { ImageStorage } from '../../../shared/storage/image-storage.js';
import { validateImage, type UploadedImage } from '../../../shared/storage/image.js';
import {
  missingSteps,
  resolvePrivacy,
  type Profile,
  type ResolvedPrivacy,
} from '../domain/profile.js';
import type { IdGenerator, PrivateData, ProfileRepository, RiotAccountStatus } from './ports.js';

async function loadProfile(profiles: ProfileRepository, userId: string): Promise<Profile> {
  const profile = await profiles.findById(userId);
  if (!profile) throw notFound('profile_not_found');
  return profile;
}

async function toProfileResponse(
  profile: Profile,
  riot: RiotAccountStatus,
  storage: ImageStorage,
): Promise<ProfileResponse> {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: storage.publicUrl('avatars', profile.avatarPath),
    countryCode: profile.countryCode,
    gameRegion: profile.gameRegion,
    birthDate: profile.birthDate,
    primaryRole: profile.primaryRole,
    secondaryRole: profile.secondaryRole,
    bio: profile.bio,
    isFreeAgent: profile.isFreeAgent,
    missing: missingSteps(profile, await riot.hasVerifiedAccount(profile.id)),
  };
}

export class GetMyProfileUseCase {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly riot: RiotAccountStatus,
    private readonly storage: ImageStorage,
  ) {}

  async execute(userId: string): Promise<ProfileResponse> {
    return toProfileResponse(await loadProfile(this.profiles, userId), this.riot, this.storage);
  }
}

export class UpdateProfileUseCase {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly riot: RiotAccountStatus,
    private readonly storage: ImageStorage,
  ) {}

  async execute(userId: string, input: UpdateProfileRequest): Promise<ProfileResponse> {
    await loadProfile(this.profiles, userId);
    await this.profiles.update(userId, input);
    return toProfileResponse(await loadProfile(this.profiles, userId), this.riot, this.storage);
  }
}

export class UploadAvatarUseCase {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly storage: ImageStorage,
    private readonly newId: IdGenerator,
    private readonly riot: RiotAccountStatus,
  ) {}

  async execute(userId: string, file: UploadedImage | undefined): Promise<ProfileResponse> {
    const image = validateImage(file);
    await loadProfile(this.profiles, userId);
    // A new name per upload, so caches never serve the old picture.
    const path = `${userId}/${this.newId()}.${image.extension}`;
    await this.storage.upload('avatars', path, image.bytes, image.type);
    const previous = await this.profiles.setAvatarPath(userId, path);
    if (previous) await this.storage.remove('avatars', previous);
    return toProfileResponse(await loadProfile(this.profiles, userId), this.riot, this.storage);
  }
}

const EMPTY_PRIVATE_DATA: PrivateData = {
  legalFirstName: null,
  legalLastName: null,
  phoneE164: null,
  institutionalEmail: null,
  gender: null,
  genderDeclaredAt: null,
  genderLocked: false,
};

function toPrivateDataResponse(data: PrivateData): PrivateDataResponse {
  return { ...data, genderDeclaredAt: data.genderDeclaredAt?.toISOString() ?? null };
}

export class GetPrivateDataUseCase {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(userId: string): Promise<PrivateDataResponse> {
    return toPrivateDataResponse(
      (await this.profiles.getPrivateData(userId)) ?? EMPTY_PRIVATE_DATA,
    );
  }
}

export class UpdatePrivateDataUseCase {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * The gender is declared once and then locked (docs/12 §3): changing it
   * needs a reviewed request. Its date lets women's events check it was
   * declared before the announcement.
   */
  async execute(userId: string, input: UpdatePrivateDataRequest): Promise<PrivateDataResponse> {
    const current = (await this.profiles.getPrivateData(userId)) ?? EMPTY_PRIVATE_DATA;
    let { gender, genderDeclaredAt, genderLocked } = current;
    if (input.gender !== null && input.gender !== current.gender) {
      if (current.genderLocked) throw conflict('gender_locked');
      gender = input.gender;
      genderDeclaredAt = this.clock.now();
      genderLocked = true;
    }
    const next: PrivateData = {
      legalFirstName: input.legalFirstName,
      legalLastName: input.legalLastName,
      phoneE164: input.phoneE164,
      institutionalEmail: input.institutionalEmail,
      gender,
      genderDeclaredAt,
      genderLocked,
    };
    await this.profiles.savePrivateData(userId, next);
    return toPrivateDataResponse(next);
  }
}

export class GetPrivacyUseCase {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(userId: string): Promise<ResolvedPrivacy> {
    return resolvePrivacy((await this.profiles.getPrivacy([userId])).get(userId) ?? {});
  }
}

export class UpdatePrivacyUseCase {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(userId: string, settings: PrivacySettings): Promise<ResolvedPrivacy> {
    await this.profiles.savePrivacy(userId, settings);
    return resolvePrivacy((await this.profiles.getPrivacy([userId])).get(userId) ?? {});
  }
}

export class GetSocialLinksUseCase {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(userId: string): Promise<UpdateSocialLinksRequest> {
    return { links: await this.profiles.getSocialLinks(userId) };
  }
}

export class UpdateSocialLinksUseCase {
  constructor(private readonly profiles: ProfileRepository) {}

  async execute(
    userId: string,
    input: UpdateSocialLinksRequest,
  ): Promise<UpdateSocialLinksRequest> {
    await this.profiles.replaceSocialLinks(userId, input.links);
    return { links: await this.profiles.getSocialLinks(userId) };
  }
}

export class SearchUsersUseCase {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly storage: ImageStorage,
  ) {}

  async execute(query: string): Promise<UserSearchResult[]> {
    const found = await this.profiles.search(query, 10);
    return found.flatMap((p) =>
      p.username === null
        ? []
        : [
            {
              id: p.id,
              username: p.username,
              displayName: p.displayName,
              avatarUrl: this.storage.publicUrl('avatars', p.avatarPath),
            },
          ],
    );
  }
}

export interface UserSummary {
  readonly username: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}

/** Read API other modules use (teams, public pages). */
export class ProfileQueries {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly storage: ImageStorage,
  ) {}

  async summaries(userIds: readonly string[]): Promise<Map<string, UserSummary>> {
    if (userIds.length === 0) return new Map();
    const found = await this.profiles.findByIds(userIds);
    return new Map(
      found.map((p) => [
        p.id,
        {
          username: p.username,
          displayName: p.displayName,
          avatarUrl: this.storage.publicUrl('avatars', p.avatarPath),
        },
      ]),
    );
  }

  findById(userId: string): Promise<Profile | null> {
    return this.profiles.findById(userId);
  }

  findByUsername(username: string): Promise<Profile | null> {
    return this.profiles.findByUsername(username);
  }

  async privacyOf(userIds: readonly string[]): Promise<Map<string, ResolvedPrivacy>> {
    const settings = await this.profiles.getPrivacy(userIds);
    return new Map(userIds.map((id) => [id, resolvePrivacy(settings.get(id) ?? {})]));
  }

  socialLinksOf(userId: string) {
    return this.profiles.getSocialLinks(userId);
  }

  avatarUrl(path: string | null): string | null {
    return this.storage.publicUrl('avatars', path);
  }
}
