import { describe, expect, it } from 'vitest';

import { canSee, isAdult, missingSteps, resolvePrivacy, type Profile } from './profile.js';

const complete: Profile = {
  id: 'u1',
  username: 'ana',
  displayName: 'Ana',
  avatarPath: null,
  countryCode: 'MX',
  gameRegion: 'la1',
  birthDate: '2004-05-10',
  primaryRole: 'mid',
  secondaryRole: null,
  bio: null,
  isFreeAgent: false,
  platformRole: 'user',
};

describe('onboarding', () => {
  it('lists what is still missing to compete, in order', () => {
    const empty: Profile = {
      ...complete,
      username: null,
      countryCode: null,
      gameRegion: null,
      birthDate: null,
      primaryRole: null,
    };
    expect(missingSteps(empty, false)).toEqual([
      'username',
      'country',
      'game_region',
      'birth_date',
      'riot_account',
      'roles',
    ]);
    expect(missingSteps(complete, true)).toEqual([]);
    expect(missingSteps(complete, false)).toEqual(['riot_account']);
  });
});

describe('privacy', () => {
  it('fills defaults: public profile, private age', () => {
    expect(resolvePrivacy({ bio: 'team' })).toMatchObject({
      bio: 'team',
      country: 'public',
      age: 'private',
    });
  });

  it('shows each visibility to the right audience', () => {
    expect(canSee('public', 'public')).toBe(true);
    expect(canSee('team', 'public')).toBe(false);
    expect(canSee('team', 'team')).toBe(true);
    expect(canSee('team', 'staff')).toBe(true);
    expect(canSee('staff', 'team')).toBe(false);
    expect(canSee('staff', 'staff')).toBe(true);
    expect(canSee('private', 'staff')).toBe(false);
  });

  it('computes adulthood on the birthday, never exposing the date', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(isAdult('2008-10-24', now)).toBe(true);
    expect(isAdult('2008-10-25', now)).toBe(false);
    expect(isAdult(null, now)).toBeNull();
  });
});
