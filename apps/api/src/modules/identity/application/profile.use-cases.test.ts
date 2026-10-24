import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared/clock.js';
import { FakeImageStorage, PNG_BYTES } from '../testing/fake-image-storage.js';
import {
  emptyProfile,
  InMemoryProfileRepository,
} from '../testing/in-memory-profile-repository.js';
import {
  GetMyProfileUseCase,
  GetPrivateDataUseCase,
  ProfileQueries,
  SearchUsersUseCase,
  UpdatePrivacyUseCase,
  UpdatePrivateDataUseCase,
  UpdateProfileUseCase,
  UpdateSocialLinksUseCase,
  UploadAvatarUseCase,
} from './profile.use-cases.js';

const clock: Clock = { now: () => new Date('2026-10-24T12:00:00.000Z') };

function setup({ riot = false } = {}) {
  const profiles = new InMemoryProfileRepository()
    .add(emptyProfile('ana', { displayName: 'Ana' }))
    .add(emptyProfile('beto', { username: 'beto', displayName: 'Beto' }));
  const riotStatus = { hasVerifiedAccount: () => Promise.resolve(riot) };
  const storage = new FakeImageStorage();
  let id = 0;
  return {
    profiles,
    storage,
    getMine: new GetMyProfileUseCase(profiles, riotStatus, storage),
    update: new UpdateProfileUseCase(profiles, riotStatus, storage),
    getPrivate: new GetPrivateDataUseCase(profiles),
    updatePrivate: new UpdatePrivateDataUseCase(profiles, clock),
    updatePrivacy: new UpdatePrivacyUseCase(profiles),
    updateLinks: new UpdateSocialLinksUseCase(profiles),
    upload: new UploadAvatarUseCase(
      profiles,
      storage,
      () => `img-${String((id += 1))}`,
      riotStatus,
    ),
    search: new SearchUsersUseCase(profiles, storage),
    queries: new ProfileQueries(profiles, storage),
  };
}

const completeProfile = {
  displayName: 'Ana',
  username: 'ana_mid',
  countryCode: 'MX',
  gameRegion: 'la1' as const,
  birthDate: '2004-05-10',
  primaryRole: 'mid' as const,
  secondaryRole: 'support' as const,
  bio: null,
};

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('profile', () => {
  it('guides onboarding with the missing steps', async () => {
    const { getMine } = setup();
    expect((await getMine.execute('ana')).missing).toEqual([
      'username',
      'country',
      'game_region',
      'birth_date',
      'riot_account',
      'roles',
    ]);
  });

  it('completes the profile; only the Riot account is left', async () => {
    const { update } = setup();
    const profile = await update.execute('ana', completeProfile);
    expect(profile).toMatchObject({
      username: 'ana_mid',
      countryCode: 'MX',
      missing: ['riot_account'],
    });
  });

  it('is complete with a verified Riot account', async () => {
    const { update } = setup({ riot: true });
    expect((await update.execute('ana', completeProfile)).missing).toEqual([]);
  });

  it('keeps usernames unique', async () => {
    const { update } = setup();
    expect(await codeOf(update.execute('ana', { ...completeProfile, username: 'beto' }))).toBe(
      'username_taken',
    );
  });

  it('fails for a user without profile row', async () => {
    const { getMine } = setup();
    expect(await codeOf(getMine.execute('ghost'))).toBe('profile_not_found');
  });
});

describe('private data', () => {
  const data = {
    legalFirstName: 'Ana',
    legalLastName: 'López',
    phoneE164: null,
    institutionalEmail: null,
    gender: null,
  };

  it('starts empty and saves the fields', async () => {
    const { getPrivate, updatePrivate } = setup();
    await expect(getPrivate.execute('ana')).resolves.toMatchObject({
      legalFirstName: null,
      genderLocked: false,
    });
    await expect(updatePrivate.execute('ana', data)).resolves.toMatchObject({
      legalFirstName: 'Ana',
      gender: null,
    });
  });

  it('locks the gender after the first declaration, with its date', async () => {
    const { updatePrivate } = setup();
    const declared = await updatePrivate.execute('ana', { ...data, gender: 'woman' });
    expect(declared).toMatchObject({
      gender: 'woman',
      genderLocked: true,
      genderDeclaredAt: '2026-10-24T12:00:00.000Z',
    });

    expect(await codeOf(updatePrivate.execute('ana', { ...data, gender: 'man' }))).toBe(
      'gender_locked',
    );
    // Saving other fields keeps the declared gender.
    await expect(
      updatePrivate.execute('ana', { ...data, gender: null, legalFirstName: 'Ana M.' }),
    ).resolves.toMatchObject({
      gender: 'woman',
      legalFirstName: 'Ana M.',
    });
  });
});

describe('privacy, links and avatar', () => {
  it('merges privacy settings over the defaults', async () => {
    const { updatePrivacy } = setup();
    await expect(updatePrivacy.execute('ana', { bio: 'team' })).resolves.toMatchObject({
      bio: 'team',
      country: 'public',
      age: 'private',
    });
  });

  it('replaces the social links', async () => {
    const { updateLinks } = setup();
    const links = [
      {
        platform: 'twitch' as const,
        url: 'https://twitch.tv/ana',
        handle: 'ana',
        visibility: 'public' as const,
      },
    ];
    await expect(updateLinks.execute('ana', { links })).resolves.toEqual({ links });
  });

  it('uploads an avatar, stores its path and removes the previous one', async () => {
    const { upload, storage } = setup();
    const first = await upload.execute('ana', { buffer: PNG_BYTES, size: PNG_BYTES.length });
    expect(first.avatarUrl).toBe('https://storage.test/avatars/ana/img-1.png');
    await upload.execute('ana', { buffer: PNG_BYTES, size: PNG_BYTES.length });
    expect(storage.removed).toEqual(['avatars/ana/img-1.png']);
  });

  it('rejects files that are not images or too big', async () => {
    const { upload } = setup();
    expect(await codeOf(upload.execute('ana', { buffer: Buffer.from('GIF89a'), size: 6 }))).toBe(
      'invalid_image',
    );
    expect(await codeOf(upload.execute('ana', { buffer: PNG_BYTES, size: 3 * 1024 * 1024 }))).toBe(
      'file_too_large',
    );
    expect(await codeOf(upload.execute('ana', undefined))).toBe('image_required');
  });
});

describe('user search and summaries', () => {
  it('finds users with a username, never the ones without', async () => {
    const { search } = setup();
    await expect(search.execute('bet')).resolves.toEqual([
      { id: 'beto', username: 'beto', displayName: 'Beto', avatarUrl: null },
    ]);
  });

  it('summarizes users for rosters', async () => {
    const { queries } = setup();
    const summaries = await queries.summaries(['beto']);
    expect(summaries.get('beto')).toEqual({
      username: 'beto',
      displayName: 'Beto',
      avatarUrl: null,
    });
  });
});
