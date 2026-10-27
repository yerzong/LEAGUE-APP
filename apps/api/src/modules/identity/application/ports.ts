import type { Gender, PrivacySettings, SocialLink } from '@league/contracts';

import type { AuthenticatedUser } from '../domain/authenticated-user.js';
import type { Profile } from '../domain/profile.js';

export interface AccessTokenVerifier {
  /** Returns the user for a valid, unexpired token; null otherwise. Never throws for bad tokens. */
  verify(accessToken: string): Promise<AuthenticatedUser | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('AccessTokenVerifier');

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export type ProfileChanges = Pick<
  Profile,
  | 'displayName'
  | 'username'
  | 'countryCode'
  | 'gameRegion'
  | 'birthDate'
  | 'primaryRole'
  | 'secondaryRole'
  | 'bio'
>;

export interface PrivateData {
  readonly legalFirstName: string | null;
  readonly legalLastName: string | null;
  readonly phoneE164: string | null;
  readonly institutionalEmail: string | null;
  readonly gender: Gender | null;
  readonly genderDeclaredAt: Date | null;
  readonly genderLocked: boolean;
}

export interface ProfileRepository {
  findById(userId: string): Promise<Profile | null>;
  findByUsername(username: string): Promise<Profile | null>;
  findByIds(userIds: readonly string[]): Promise<Profile[]>;
  /** Throws `username_taken`. */
  update(userId: string, changes: ProfileChanges): Promise<void>;
  /** Returns the previous path. */
  setAvatarPath(userId: string, path: string): Promise<string | null>;
  getPrivateData(userId: string): Promise<PrivateData | null>;
  savePrivateData(userId: string, data: PrivateData): Promise<void>;
  getPrivacy(userIds: readonly string[]): Promise<Map<string, PrivacySettings>>;
  savePrivacy(userId: string, settings: PrivacySettings): Promise<void>;
  getSocialLinks(userId: string): Promise<SocialLink[]>;
  replaceSocialLinks(userId: string, links: readonly SocialLink[]): Promise<void>;
  /** Users with a username starting with or containing `query` (case-insensitive). */
  search(query: string, limit: number): Promise<Profile[]>;
  /** Active users with a username, filtered by username or display name. */
  listPublic(window: {
    query: string;
    limit: number;
    offset: number;
  }): Promise<{ profiles: Profile[]; total: number }>;
}

export const PROFILE_REPOSITORY = Symbol('ProfileRepository');

/** What identity needs from riot-accounts (its exported RiotAccountQueries). */
export interface RiotAccountStatus {
  hasVerifiedAccount(userId: string): Promise<boolean>;
}

export const RIOT_ACCOUNT_STATUS = Symbol('RiotAccountStatus');

/** Random ids for storage paths. */
export type IdGenerator = () => string;
export const ID_GENERATOR = Symbol('IdGenerator');
