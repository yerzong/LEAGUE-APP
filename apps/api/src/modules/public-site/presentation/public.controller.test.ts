import 'reflect-metadata';

import { ApiErrorSchema, DEFAULT_PRIVACY, PublicTeamListSchema } from '@league/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module.js';
import { testEnv } from '../../../config/test-env.js';
import { emptyProfile } from '../../identity/testing/in-memory-profile-repository.js';
import { PUBLIC_PAGES_DEPS, type PublicPagesDeps } from '../application/public-pages.js';

const team = {
  id: '00000000-0000-4000-8000-0000000000a1',
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
const seen: unknown[] = [];

const deps: PublicPagesDeps = {
  teams: {
    findBySlug: () => Promise.resolve(null),
    activeMembers: () => Promise.resolve([]),
    activeTeamsOf: () => Promise.resolve([]),
    logoUrl: () => null,
    listActive: (window) => {
      seen.push(window);
      return Promise.resolve({ teams: [team], total: 1 });
    },
    memberCounts: () => Promise.resolve(new Map([[team.id, 5]])),
  },
  profiles: {
    findById: () => Promise.resolve(null),
    findByUsername: () => Promise.resolve(null),
    privacyOf: (ids) => Promise.resolve(new Map(ids.map((id) => [id, DEFAULT_PRIVACY]))),
    socialLinksOf: () => Promise.resolve([]),
    avatarUrl: () => null,
    listPublic: () =>
      Promise.resolve({ profiles: [emptyProfile('ana', { username: 'ana' })], total: 1 }),
  },
  riot: { riotIdsOf: () => Promise.resolve(new Map()), accountOf: () => Promise.resolve(null) },
  clock: { now: () => new Date() },
};

describe('public directory HTTP API', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testEnv())] })
      .overrideProvider(PUBLIC_PAGES_DEPS)
      .useValue(deps)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists teams without a session, paging from the query string', async () => {
    const response = await fetch(`${baseUrl}/public/teams?q=aur&page=2&pageSize=10`);
    expect(response.status).toBe(200);
    const body = PublicTeamListSchema.parse(await response.json());
    expect(body).toMatchObject({ total: 1, page: 2, pageSize: 10 });
    expect(body.items[0]).toMatchObject({ slug: 'aurora', memberCount: 5 });
    expect(seen.at(-1)).toEqual({ query: 'aur', limit: 10, offset: 10 });
  });

  it('lists players without a session', async () => {
    const response = await fetch(`${baseUrl}/public/players`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ username: 'ana' }], total: 1 });
  });

  it('rejects a search that could break the filter', async () => {
    const response = await fetch(`${baseUrl}/public/players?q=${encodeURIComponent('a,b')}`);
    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe('validation_failed');
  });
});
