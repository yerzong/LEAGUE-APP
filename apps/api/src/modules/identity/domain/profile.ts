import {
  DEFAULT_PRIVACY,
  type GameRegion,
  type OnboardingStep,
  type PlayerRole,
  type PrivacyField,
  type PrivacySettings,
  type PrivacyVisibility,
} from '@league/contracts';
import type { PlatformRole } from '@league/db';

export interface Profile {
  readonly id: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly avatarPath: string | null;
  readonly countryCode: string | null;
  readonly gameRegion: GameRegion | null;
  readonly birthDate: string | null;
  readonly primaryRole: PlayerRole | null;
  readonly secondaryRole: PlayerRole | null;
  readonly bio: string | null;
  readonly isFreeAgent: boolean;
  readonly platformRole: PlatformRole;
}

/** Required to compete (docs/12 §3): basic data, a verified Riot account and roles. */
export function missingSteps(profile: Profile, hasVerifiedRiotAccount: boolean): OnboardingStep[] {
  const steps: [OnboardingStep, boolean][] = [
    ['username', profile.username === null],
    ['country', profile.countryCode === null],
    ['game_region', profile.gameRegion === null],
    ['birth_date', profile.birthDate === null],
    ['riot_account', !hasVerifiedRiotAccount],
    ['roles', profile.primaryRole === null],
  ];
  return steps.filter(([, missing]) => missing).map(([step]) => step);
}

export type ResolvedPrivacy = Readonly<Record<PrivacyField, PrivacyVisibility>>;

export function resolvePrivacy(settings: PrivacySettings): ResolvedPrivacy {
  return { ...DEFAULT_PRIVACY, ...settings };
}

/** What a viewer may see of someone: the public, a teammate, or staff. */
export type ViewerLevel = 'public' | 'team' | 'staff';

const AUDIENCE: Readonly<Record<PrivacyVisibility, readonly ViewerLevel[]>> = {
  public: ['public', 'team', 'staff'],
  team: ['team', 'staff'],
  staff: ['staff'],
  private: [],
};

export function canSee(visibility: PrivacyVisibility, viewer: ViewerLevel): boolean {
  return AUDIENCE[visibility].includes(viewer);
}

/** Public pages show "adult" or nothing, never the birth date (docs/12 §3). */
export function isAdult(birthDate: string | null, now: Date): boolean | null {
  if (birthDate === null) return null;
  const [year = 0, month = 1, day = 1] = birthDate.split('-').map(Number);
  const adultSince = Date.UTC(year + 18, month - 1, day);
  return now.getTime() >= adultSince;
}
