import { describe, expect, it } from 'vitest';

import {
  CreateInvitationRequestSchema,
  CreateTeamRequestSchema,
  StartRiotVerificationRequestSchema,
  UpdateFreeAgentRequestSchema,
  UpdatePrivateDataRequestSchema,
  UpdateProfileRequestSchema,
  UpdateSocialLinksRequestSchema,
} from '../index.js';

const profile = {
  displayName: ' Ana ',
  username: 'Ana_Mid',
  countryCode: 'mx',
  gameRegion: 'la1',
  birthDate: '2004-05-10',
  primaryRole: 'mid',
  secondaryRole: 'support',
  bio: '',
};

describe('profile contracts', () => {
  it('normalizes the profile: trimmed name, lowercase username, uppercase country, empty bio as null', () => {
    expect(UpdateProfileRequestSchema.parse(profile)).toMatchObject({
      displayName: 'Ana',
      username: 'ana_mid',
      countryCode: 'MX',
      bio: null,
    });
  });

  it('rejects invalid usernames, equal roles and impossible birth dates', () => {
    expect(UpdateProfileRequestSchema.safeParse({ ...profile, username: 'a b' }).success).toBe(
      false,
    );
    expect(UpdateProfileRequestSchema.safeParse({ ...profile, secondaryRole: 'mid' }).success).toBe(
      false,
    );
    expect(
      UpdateProfileRequestSchema.safeParse({ ...profile, birthDate: '2999-01-01' }).success,
    ).toBe(false);
    expect(
      UpdateProfileRequestSchema.safeParse({ ...profile, birthDate: '1850-01-01' }).success,
    ).toBe(false);
    expect(
      UpdateProfileRequestSchema.safeParse({ ...profile, primaryRole: null, secondaryRole: null })
        .success,
    ).toBe(true);
  });

  it('validates private data and turns empty fields into null', () => {
    const empty = {
      legalFirstName: '',
      legalLastName: '',
      phoneE164: '',
      institutionalEmail: '',
      gender: null,
    };
    expect(UpdatePrivateDataRequestSchema.parse(empty)).toEqual({
      legalFirstName: null,
      legalLastName: null,
      phoneE164: null,
      institutionalEmail: null,
      gender: null,
    });
    expect(
      UpdatePrivateDataRequestSchema.safeParse({ ...empty, phoneE164: '5512345678' }).success,
    ).toBe(false);
    expect(
      UpdatePrivateDataRequestSchema.safeParse({ ...empty, phoneE164: '+525512345678' }).success,
    ).toBe(true);
    expect(
      UpdatePrivateDataRequestSchema.safeParse({ ...empty, institutionalEmail: 'nope' }).success,
    ).toBe(false);
  });

  it('accepts only https social links, up to eight', () => {
    const link = {
      platform: 'twitch',
      url: 'https://twitch.tv/ana',
      handle: '',
      visibility: 'public',
    };
    expect(UpdateSocialLinksRequestSchema.safeParse({ links: [link] }).success).toBe(true);
    expect(
      UpdateSocialLinksRequestSchema.safeParse({
        links: [{ ...link, url: 'http://twitch.tv/ana' }],
      }).success,
    ).toBe(false);
    expect(UpdateSocialLinksRequestSchema.safeParse({ links: Array(9).fill(link) }).success).toBe(
      false,
    );
  });
});

describe('riot and team contracts', () => {
  it('validates the Riot ID parts', () => {
    expect(
      StartRiotVerificationRequestSchema.safeParse({
        gameName: 'Ana Mid',
        tagLine: 'LAN',
        region: 'la1',
      }).success,
    ).toBe(true);
    expect(
      StartRiotVerificationRequestSchema.safeParse({
        gameName: 'An',
        tagLine: 'LAN',
        region: 'la1',
      }).success,
    ).toBe(false);
    expect(
      StartRiotVerificationRequestSchema.safeParse({
        gameName: 'Ana',
        tagLine: 'L#N',
        region: 'la1',
      }).success,
    ).toBe(false);
    expect(
      StartRiotVerificationRequestSchema.safeParse({
        gameName: 'Ana',
        tagLine: 'LAN',
        region: 'euw1',
      }).success,
    ).toBe(false);
  });

  it('uppercases team tags and validates names', () => {
    expect(
      CreateTeamRequestSchema.parse({
        name: ' Aurora ',
        tag: 'aur',
        region: 'la1',
        description: '',
      }),
    ).toEqual({
      name: 'Aurora',
      tag: 'AUR',
      region: 'la1',
      description: null,
    });
    expect(
      CreateTeamRequestSchema.safeParse({
        name: 'Au',
        tag: 'AUR',
        region: 'la1',
        description: null,
      }).success,
    ).toBe(false);
    expect(
      CreateTeamRequestSchema.safeParse({
        name: 'Aurora',
        tag: 'AURORA',
        region: 'la1',
        description: null,
      }).success,
    ).toBe(false);
  });

  it('invites a user or by link, never as captain', () => {
    expect(
      CreateInvitationRequestSchema.safeParse({ kind: 'link', teamRole: 'player' }).success,
    ).toBe(true);
    expect(
      CreateInvitationRequestSchema.safeParse({
        kind: 'user',
        userId: '01920000-0000-7000-8000-0000000000a1',
        teamRole: 'coach',
      }).success,
    ).toBe(true);
    expect(
      CreateInvitationRequestSchema.safeParse({ kind: 'link', teamRole: 'captain' }).success,
    ).toBe(false);
  });

  it('validates the free agent availability', () => {
    const base = {
      active: true,
      roles: ['mid'],
      message: '',
      availability: { version: 1, days: [1, 3], from: '19:00', to: '23:00' },
    };
    expect(UpdateFreeAgentRequestSchema.safeParse(base).success).toBe(true);
    expect(UpdateFreeAgentRequestSchema.safeParse({ ...base, roles: [] }).success).toBe(false);
    expect(
      UpdateFreeAgentRequestSchema.safeParse({
        ...base,
        availability: { ...base.availability, from: '25:00' },
      }).success,
    ).toBe(false);
  });
});
