// Test double for ProfileRepository with the database's username uniqueness.
import type { PrivacySettings, SocialLink } from '@league/contracts';

import { conflict } from '../../../shared/application-error.js';
import type {
  PrivateData,
  ProfileChanges,
  ProfileRepository,
  EligibilityPrivateData,
} from '../application/ports.js';
import type { Profile } from '../domain/profile.js';

export const emptyProfile = (id: string, overrides: Partial<Profile> = {}): Profile => ({
  id,
  username: null,
  displayName: null,
  avatarPath: null,
  countryCode: null,
  gameRegion: null,
  birthDate: null,
  primaryRole: null,
  secondaryRole: null,
  bio: null,
  isFreeAgent: false,
  platformRole: 'user',
  ...overrides,
});

export class InMemoryProfileRepository implements ProfileRepository {
  readonly profiles = new Map<string, Profile>();
  readonly privateData = new Map<string, PrivateData>();
  readonly privacy = new Map<string, PrivacySettings>();
  readonly socialLinks = new Map<string, SocialLink[]>();

  add(profile: Profile): this {
    this.profiles.set(profile.id, profile);
    return this;
  }

  findById(userId: string): Promise<Profile | null> {
    return Promise.resolve(this.profiles.get(userId) ?? null);
  }

  findByUsername(username: string): Promise<Profile | null> {
    return Promise.resolve(
      [...this.profiles.values()].find((p) => p.username === username.toLowerCase()) ?? null,
    );
  }

  findByIds(userIds: readonly string[]): Promise<Profile[]> {
    return Promise.resolve([...this.profiles.values()].filter((p) => userIds.includes(p.id)));
  }

  update(userId: string, changes: ProfileChanges): Promise<void> {
    const taken = [...this.profiles.values()].some(
      (p) => p.id !== userId && p.username === changes.username,
    );
    if (taken) return Promise.reject(conflict('username_taken'));
    const current = this.profiles.get(userId);
    if (current) this.profiles.set(userId, { ...current, ...changes });
    return Promise.resolve();
  }

  setAvatarPath(userId: string, path: string): Promise<string | null> {
    const current = this.profiles.get(userId);
    if (current) this.profiles.set(userId, { ...current, avatarPath: path });
    return Promise.resolve(current?.avatarPath ?? null);
  }

  eligibilityDataOf(userIds: readonly string[]): Promise<Map<string, EligibilityPrivateData>> {
    return Promise.resolve(
      new Map(
        userIds.flatMap((id) => {
          const data = this.privateData.get(id);
          if (!data) return [];
          return [
            [
              id,
              {
                legalNameProvided: Boolean(data.legalFirstName && data.legalLastName),
                gender: data.gender,
                genderDeclaredAt: data.genderDeclaredAt,
                institutionalEmail: data.institutionalEmail,
                institutionalEmailVerified: false,
              },
            ] as const,
          ];
        }),
      ),
    );
  }

  getPrivateData(userId: string): Promise<PrivateData | null> {
    return Promise.resolve(this.privateData.get(userId) ?? null);
  }

  savePrivateData(userId: string, data: PrivateData): Promise<void> {
    this.privateData.set(userId, data);
    return Promise.resolve();
  }

  getPrivacy(userIds: readonly string[]): Promise<Map<string, PrivacySettings>> {
    return Promise.resolve(new Map(userIds.map((id) => [id, this.privacy.get(id) ?? {}])));
  }

  savePrivacy(userId: string, settings: PrivacySettings): Promise<void> {
    this.privacy.set(userId, { ...this.privacy.get(userId), ...settings });
    return Promise.resolve();
  }

  getSocialLinks(userId: string): Promise<SocialLink[]> {
    return Promise.resolve(this.socialLinks.get(userId) ?? []);
  }

  replaceSocialLinks(userId: string, links: readonly SocialLink[]): Promise<void> {
    this.socialLinks.set(userId, [...links]);
    return Promise.resolve();
  }

  listPublic({ query, limit, offset }: { query: string; limit: number; offset: number }) {
    const q = query.toLowerCase();
    const found = [...this.profiles.values()]
      .filter(
        (p) =>
          p.username !== null &&
          (p.username.includes(q) || (p.displayName?.toLowerCase().includes(q) ?? false)),
      )
      .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''));
    return Promise.resolve({ profiles: found.slice(offset, offset + limit), total: found.length });
  }

  search(query: string, limit: number): Promise<Profile[]> {
    const q = query.toLowerCase();
    return Promise.resolve(
      [...this.profiles.values()].filter((p) => p.username?.includes(q)).slice(0, limit),
    );
  }
}
