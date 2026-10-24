import 'reflect-metadata';

import { ApiErrorSchema, TeamDetailSchema } from '@league/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module.js';
import { testEnv } from '../../../config/test-env.js';
import { FakeImageStorage, PNG_BYTES } from '../../identity/testing/fake-image-storage.js';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from '../../identity/application/ports.js';
import { TEAMS_DEPS, type TeamsDeps } from '../application/deps.js';
import {
  InMemoryFreeAgentRepository,
  InMemoryTeamRepository,
} from '../testing/in-memory-team-repository.js';

const ANA = '01920000-0000-7000-8000-0000000000a1';
const BETO = '01920000-0000-7000-8000-0000000000b1';

const verifier: AccessTokenVerifier = {
  verify: (token) =>
    Promise.resolve(
      token === 'ana'
        ? { id: ANA, email: null }
        : token === 'beto'
          ? { id: BETO, email: null }
          : null,
    ),
};

const deps: TeamsDeps = {
  teams: new InMemoryTeamRepository(),
  freeAgents: new InMemoryFreeAgentRepository(),
  users: {
    summaries: (ids) =>
      Promise.resolve(
        new Map(
          ids.map((id) => [
            id,
            { username: id === ANA ? 'ana' : 'beto', displayName: null, avatarUrl: null },
          ]),
        ),
      ),
    findById: (id) => Promise.resolve({ id }),
  },
  riot: {
    hasVerifiedAccount: (id) => Promise.resolve(id === ANA),
    riotIdsOf: () => Promise.resolve(new Map()),
  },
  organization: { id: () => Promise.resolve('org') },
  storage: new FakeImageStorage(),
  clock: { now: () => new Date() },
  newCode: () => 'link-code-0000000000001',
  newId: () => 'logo',
};

describe('teams HTTP API', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testEnv())] })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue(verifier)
      .overrideProvider(TEAMS_DEPS)
      .useValue(deps)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (path: string, token: string | null, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      },
    });

  it('requires a session', async () => {
    const response = await call('/teams/mine', null);
    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json())).toEqual({ code: 'unauthorized' });
  });

  it('validates the body and lists the fields, never the values', async () => {
    const response = await call('/teams', 'ana', {
      method: 'POST',
      body: JSON.stringify({ name: 'x', tag: 'toolong', region: 'euw1' }),
    });
    expect(response.status).toBe(400);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe('validation_failed');
    expect(JSON.stringify(body)).not.toContain('toolong');
  });

  it('creates a team, uploads its logo and maps business rules to 409 with their code', async () => {
    const created = await call('/teams', 'ana', {
      method: 'POST',
      body: JSON.stringify({ name: 'Aurora', tag: 'aur', region: 'la1', description: '' }),
    });
    expect(created.status).toBe(201);
    const team = TeamDetailSchema.parse(await created.json());
    expect(team).toMatchObject({ slug: 'aurora', tag: 'AUR', myRole: 'captain' });

    const form = new FormData();
    form.append('file', new Blob([PNG_BYTES], { type: 'image/png' }), 'logo.png');
    const logo = await fetch(`${baseUrl}/teams/${team.id}/logo`, {
      method: 'POST',
      body: form,
      headers: { authorization: 'Bearer ana' },
    });
    expect(logo.status).toBe(201);

    const duplicate = await call('/teams', 'beto', {
      method: 'POST',
      body: JSON.stringify({ name: 'AURORA', tag: 'NEW', region: 'la1', description: null }),
    });
    expect(duplicate.status).toBe(409);
    // Beto has no verified Riot account: the core rule answers first.
    expect(ApiErrorSchema.parse(await duplicate.json()).code).toBe('riot_account_required');

    const outsider = await call(`/teams/by-slug/${team.slug}`, 'beto');
    expect(outsider.status).toBe(403);
    expect(ApiErrorSchema.parse(await outsider.json()).code).toBe('not_a_member');

    const badId = await call('/teams/not-a-uuid/leave', 'ana', { method: 'POST' });
    expect(badId.status).toBe(400);
  });
});
