import type { PrivacySettings, SocialLink } from '@league/contracts';
import type { Tables } from '@league/db';

import { conflict } from '../../../shared/application-error.js';
import { assertNoError, isUniqueViolation } from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
import type { PrivateData, ProfileChanges, ProfileRepository } from '../application/ports.js';
import type { Profile } from '../domain/profile.js';

const PROFILE_COLUMNS =
  'id, username, display_name, avatar_path, country_code, game_region, birth_date, primary_role, secondary_role, bio, is_free_agent, platform_role';

type ProfileRow = Pick<
  Tables<'users'>,
  | 'id'
  | 'username'
  | 'display_name'
  | 'avatar_path'
  | 'country_code'
  | 'game_region'
  | 'birth_date'
  | 'primary_role'
  | 'secondary_role'
  | 'bio'
  | 'is_free_agent'
  | 'platform_role'
>;

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
  avatarPath: row.avatar_path,
  countryCode: row.country_code,
  gameRegion: row.game_region,
  birthDate: row.birth_date,
  primaryRole: row.primary_role,
  secondaryRole: row.secondary_role,
  bio: row.bio,
  isFreeAgent: row.is_free_agent,
  platformRole: row.platform_role,
});

/** Escapes LIKE wildcards in user input. */
const likeEscape = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: AdminClient) {}

  private users() {
    return this.db.from('users').select(PROFILE_COLUMNS).is('deleted_at', null);
  }

  async findById(userId: string): Promise<Profile | null> {
    const { data, error } = await this.users().eq('id', userId).maybeSingle();
    assertNoError(error);
    return data ? toProfile(data) : null;
  }

  async findByUsername(username: string): Promise<Profile | null> {
    const { data, error } = await this.users()
      .eq('username', username)
      .eq('status', 'active')
      .maybeSingle();
    assertNoError(error);
    return data ? toProfile(data) : null;
  }

  async findByIds(userIds: readonly string[]): Promise<Profile[]> {
    const { data, error } = await this.users().in('id', [...userIds]);
    assertNoError(error);
    return (data ?? []).map(toProfile);
  }

  async update(userId: string, changes: ProfileChanges): Promise<void> {
    const { error } = await this.db
      .from('users')
      .update({
        display_name: changes.displayName,
        username: changes.username,
        country_code: changes.countryCode,
        game_region: changes.gameRegion,
        birth_date: changes.birthDate,
        primary_role: changes.primaryRole,
        secondary_role: changes.secondaryRole,
        bio: changes.bio,
      })
      .eq('id', userId);
    if (isUniqueViolation(error, 'users_username_key')) throw conflict('username_taken');
    assertNoError(error);
  }

  async setAvatarPath(userId: string, path: string): Promise<string | null> {
    const previous = await this.findById(userId);
    const { error } = await this.db.from('users').update({ avatar_path: path }).eq('id', userId);
    assertNoError(error);
    return previous?.avatarPath ?? null;
  }

  async getPrivateData(userId: string): Promise<PrivateData | null> {
    const { data, error } = await this.db
      .from('user_private_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error);
    if (!data) return null;
    return {
      legalFirstName: data.legal_first_name,
      legalLastName: data.legal_last_name,
      phoneE164: data.phone_e164,
      institutionalEmail: data.institutional_email,
      gender: data.gender,
      genderDeclaredAt: data.gender_declared_at ? new Date(data.gender_declared_at) : null,
      genderLocked: data.gender_locked,
    };
  }

  async savePrivateData(userId: string, data: PrivateData): Promise<void> {
    const { error } = await this.db.from('user_private_data').upsert({
      user_id: userId,
      legal_first_name: data.legalFirstName,
      legal_last_name: data.legalLastName,
      phone_e164: data.phoneE164,
      institutional_email: data.institutionalEmail,
      gender: data.gender,
      gender_declared_at: data.genderDeclaredAt?.toISOString() ?? null,
      gender_locked: data.genderLocked,
    });
    assertNoError(error);
  }

  async getPrivacy(userIds: readonly string[]): Promise<Map<string, PrivacySettings>> {
    const result = new Map<string, PrivacySettings>(userIds.map((id) => [id, {}]));
    if (userIds.length === 0) return result;
    const { data, error } = await this.db
      .from('user_privacy_settings')
      .select('user_id, field_key, visibility')
      .in('user_id', [...userIds]);
    assertNoError(error);
    for (const row of data ?? []) {
      result.set(row.user_id, { ...result.get(row.user_id), [row.field_key]: row.visibility });
    }
    return result;
  }

  async savePrivacy(userId: string, settings: PrivacySettings): Promise<void> {
    const rows = Object.entries(settings).map(([field_key, visibility]) => ({
      user_id: userId,
      field_key,
      visibility,
    }));
    if (rows.length === 0) return;
    const { error } = await this.db.from('user_privacy_settings').upsert(rows);
    assertNoError(error);
  }

  async getSocialLinks(userId: string): Promise<SocialLink[]> {
    const { data, error } = await this.db
      .from('user_social_links')
      .select('platform, url, handle, visibility')
      .eq('user_id', userId)
      .order('position');
    assertNoError(error);
    return data ?? [];
  }

  async replaceSocialLinks(userId: string, links: readonly SocialLink[]): Promise<void> {
    const { error } = await this.db.rpc('svc_replace_social_links', {
      p_user_id: userId,
      p_links: links.map((l) => ({ ...l })),
    });
    assertNoError(error);
  }

  async search(query: string, limit: number): Promise<Profile[]> {
    const { data, error } = await this.users()
      .eq('status', 'active')
      .not('username', 'is', null)
      .ilike('username', `%${likeEscape(query)}%`)
      .order('username')
      .limit(limit);
    assertNoError(error);
    return (data ?? []).map(toProfile);
  }
}
