import { DEFAULT_PRIVACY } from '@league/contracts';
import { describe, expect, it } from 'vitest';

import { emptyProfile } from '../../identity/testing/in-memory-profile-repository.js';
import type { PublicPagesDeps } from './public-pages.js';
import { GetPublicPlayerUseCase, GetPublicTeamUseCase } from './public-pages.js';

const team = {
  id: '00000000-0000-4000-8000-0000000000t1',
  organizationId: 'org',
  slug: 'aurora',
  name: 'Aurora',
  tag: 'AUR',
  region: 'la1' as const,
  description: null,
  logoPath: null,
  status: 'active' as const,
  ownerUserId: 'ana',
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

const profiles = {
  ana: emptyProfile('ana', {
    username: 'ana',
    displayName: 'Ana',
    primaryRole: 'mid',
    countryCode: 'MX',
    birthDate: '2004-01-01',
    bio: 'Hola',
  }),
  beto: emptyProfile('beto', { username: 'beto', displayName: 'Beto', primaryRole: 'adc' }),
  hidden: emptyProfile('hidden', { username: 'hidden', displayName: 'Oculta' }),
  staff: emptyProfile('staff', { username: 'staff', platformRole: 'super_admin' }),
  carla: emptyProfile('carla', { username: 'carla' }),
};

function deps(): PublicPagesDeps {
  const members = [
    { userId: 'ana', teamRole: 'captain' as const, gameRole: null, joinedAt: new Date() },
    {
      userId: 'beto',
      teamRole: 'player' as const,
      gameRole: 'support' as const,
      joinedAt: new Date(),
    },
    { userId: 'hidden', teamRole: 'player' as const, gameRole: null, joinedAt: new Date() },
  ];
  const privacy = {
    ana: { riot_account: 'public', roles: 'public', teams: 'public', age: 'public' },
    beto: { riot_account: 'team', roles: 'public', teams: 'public' },
    hidden: { teams: 'private' },
  } as const;
  return {
    teams: {
      findBySlug: (slug) => Promise.resolve(slug === 'aurora' ? team : null),
      activeMembers: () => Promise.resolve(members),
      activeTeamsOf: (userId) =>
        Promise.resolve(
          members.some((m) => m.userId === userId)
            ? [{ team, role: members.find((m) => m.userId === userId)?.teamRole ?? 'player' }]
            : [],
        ),
      logoUrl: () => null,
    },
    profiles: {
      findById: (id) => Promise.resolve(Object.values(profiles).find((p) => p.id === id) ?? null),
      findByUsername: (u) =>
        Promise.resolve(Object.values(profiles).find((p) => p.username === u) ?? null),
      privacyOf: (ids) =>
        Promise.resolve(
          new Map(
            ids.map((id) => [id, { ...DEFAULT_PRIVACY, ...privacy[id as keyof typeof privacy] }]),
          ),
        ),
      socialLinksOf: () =>
        Promise.resolve([
          { platform: 'twitch', url: 'https://twitch.tv/ana', handle: 'ana', visibility: 'public' },
          { platform: 'x', url: 'https://x.com/ana', handle: null, visibility: 'team' },
        ]),
      avatarUrl: () => null,
    },
    riot: {
      riotIdsOf: (ids) => Promise.resolve(new Map(ids.map((id) => [id, `${id}#LAN`]))),
      accountOf: (id) =>
        Promise.resolve(
          id === 'ana' ? { gameName: 'Ana', tagLine: 'LAN', region: 'la1' as const } : null,
        ),
    },
    clock: { now: () => new Date('2026-10-24T00:00:00Z') },
  };
}

describe('public team page', () => {
  it('shows the roster with what each player made public', async () => {
    const page = await new GetPublicTeamUseCase(deps()).execute('aurora', null);
    expect(page.members).toEqual([
      {
        username: 'ana',
        displayName: 'Ana',
        avatarUrl: null,
        teamRole: 'captain',
        primaryRole: 'mid',
        riotId: 'ana#LAN',
      },
      {
        username: 'beto',
        displayName: 'Beto',
        avatarUrl: null,
        teamRole: 'player',
        primaryRole: 'support',
        riotId: null,
      },
    ]);
  });

  it('shows team-only fields to teammates', async () => {
    const page = await new GetPublicTeamUseCase(deps()).execute('aurora', 'ana');
    expect(page.members.find((m) => m.username === 'beto')?.riotId).toBe('beto#LAN');
    expect(page.members.some((m) => m.username === 'hidden')).toBe(false);
  });

  it('is a typed 404 for unknown teams', async () => {
    await expect(new GetPublicTeamUseCase(deps()).execute('nope', null)).rejects.toMatchObject({
      code: 'team_not_found',
    });
  });
});

describe('public player page', () => {
  it('shows public data, the verified Riot ID and teams, never the birth date', async () => {
    const page = await new GetPublicPlayerUseCase(deps()).execute('ana', null);
    expect(page).toMatchObject({
      username: 'ana',
      countryCode: 'MX',
      primaryRole: 'mid',
      bio: 'Hola',
      isAdult: true,
      riotAccount: { gameName: 'Ana', tagLine: 'LAN', region: 'la1' },
      teams: [{ slug: 'aurora', teamRole: 'captain' }],
      socialLinks: [{ platform: 'twitch', url: 'https://twitch.tv/ana', handle: 'ana' }],
    });
    expect(JSON.stringify(page)).not.toContain('2004');
  });

  it('shows team links to teammates and staff', async () => {
    expect(
      (await new GetPublicPlayerUseCase(deps()).execute('ana', 'beto')).socialLinks,
    ).toHaveLength(2);
    expect(
      (await new GetPublicPlayerUseCase(deps()).execute('ana', 'staff')).socialLinks,
    ).toHaveLength(2);
    expect(
      (await new GetPublicPlayerUseCase(deps()).execute('ana', 'carla')).socialLinks,
    ).toHaveLength(1);
  });

  it('hides fields the player keeps private', async () => {
    const page = await new GetPublicPlayerUseCase(deps()).execute('hidden', null);
    expect(page).toMatchObject({ teams: [], isAdult: null, riotAccount: null });
    await expect(new GetPublicPlayerUseCase(deps()).execute('ghost', null)).rejects.toMatchObject({
      code: 'player_not_found',
    });
  });
});
