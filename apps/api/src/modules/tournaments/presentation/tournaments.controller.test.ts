import 'reflect-metadata';

import {
  ApiErrorSchema,
  DEFAULT_TOURNAMENT_CONFIG,
  PublicTournamentListSchema,
  TournamentDetailSchema,
  type TournamentConfig,
} from '@league/contracts';
import { createFormatRegistry } from '@league/core';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module.js';
import { testEnv } from '../../../config/test-env.js';
import { FakeImageStorage } from '../../identity/testing/fake-image-storage.js';
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifier,
} from '../../identity/application/ports.js';
import {
  REGISTRATIONS_DEPS,
  type RegistrationsDeps,
} from '../../registrations/application/deps.js';
import { InMemoryRegistrationRepository } from '../../registrations/testing/in-memory-registration-repository.js';
import { TOURNAMENTS_DEPS, type TournamentsDeps } from '../application/deps.js';
import { TournamentQueries } from '../application/tournaments.use-cases.js';
import {
  InMemoryTemplateRepository,
  InMemoryTournamentRepository,
} from '../testing/in-memory-tournament-repository.js';

const ADMIN = '01920000-0000-7000-8000-0000000000a1';
const ANA = '01920000-0000-7000-8000-0000000000b1';

const verifier: AccessTokenVerifier = {
  verify: (token) =>
    Promise.resolve(
      token === 'admin'
        ? { id: ADMIN, email: null }
        : token === 'ana'
          ? { id: ANA, email: null }
          : null,
    ),
};

const tournaments = new InMemoryTournamentRepository();
const tournamentsDeps: TournamentsDeps = {
  tournaments,
  templates: new InMemoryTemplateRepository(),
  staff: {
    isStaff: (id) => Promise.resolve(id === ADMIN),
    summaries: () => Promise.resolve(new Map()),
  },
  organization: { id: () => Promise.resolve('org') },
  storage: new FakeImageStorage(),
  clock: { now: () => new Date() },
  formats: createFormatRegistry(),
  newId: () => 'cover',
};
const registrationsDeps: RegistrationsDeps = {
  registrations: new InMemoryRegistrationRepository(() => new Date(), tournaments),
  tournaments: new TournamentQueries(tournamentsDeps),
  teams: {
    findById: () => Promise.resolve(null),
    activeMembers: () => Promise.resolve([]),
    activeTeamsOf: () => Promise.resolve([]),
    logoUrl: () => null,
  },
  players: { factsOf: () => Promise.resolve(new Map()) },
  clock: { now: () => new Date() },
  random: () => 0,
};

const config: TournamentConfig = {
  ...DEFAULT_TOURNAMENT_CONFIG,
  basics: { ...DEFAULT_TOURNAMENT_CONFIG.basics, name: 'Copa HTTP' },
};

describe('tournaments HTTP API', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(testEnv())] })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue(verifier)
      .overrideProvider(TOURNAMENTS_DEPS)
      .useValue(tournamentsDeps)
      .overrideProvider(REGISTRATIONS_DEPS)
      .useValue(registrationsDeps)
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
  const codeOf = async (response: Response) => ApiErrorSchema.parse(await response.json()).code;

  it('keeps the console for staff', async () => {
    expect((await call('/admin/tournaments', null)).status).toBe(401);
    const forbidden = await call('/admin/tournaments', 'ana');
    expect(forbidden.status).toBe(403);
    expect(await codeOf(forbidden)).toBe('staff_only');
  });

  it('creates a draft, refuses to publish it incomplete and maps core rules to 409', async () => {
    const created = await call('/admin/tournaments', 'admin', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
    expect(created.status).toBe(201);
    const detail = TournamentDetailSchema.parse(await created.json());
    expect(detail).toMatchObject({ slug: 'copa-http', status: 'draft' });

    const publish = await call(`/admin/tournaments/${detail.id}/actions/publish`, 'admin', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(publish.status).toBe(409);
    expect(await codeOf(publish)).toBe('publish_incomplete');

    const invalid = await call(
      `/admin/tournaments/${detail.id}/actions/close_registration`,
      'admin',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    expect(invalid.status).toBe(409);
    expect(await codeOf(invalid)).toBe('invalid_transition');

    const unknown = await call(`/admin/tournaments/${detail.id}/actions/explode`, 'admin', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(unknown.status).toBe(400);

    tournaments.setStatus(detail.id, 'completed');
    const locked = await call(`/admin/tournaments/${detail.id}`, 'admin', {
      method: 'PUT',
      body: JSON.stringify({ config: { ...config, basics: { ...config.basics, name: 'Otra' } } }),
    });
    expect(locked.status).toBe(409);
    expect(await codeOf(locked)).toBe('section_locked');
  });

  it('serves the public list without drafts, and hides drafts by slug', async () => {
    const draft = await call('/admin/tournaments', 'admin', {
      method: 'POST',
      body: JSON.stringify({
        config: { ...config, basics: { ...config.basics, name: 'Borrador' } },
      }),
    });
    const { slug } = TournamentDetailSchema.parse(await draft.json());
    const list = PublicTournamentListSchema.parse(
      await (await call('/public/tournaments', null)).json(),
    );
    expect(list.items.map((t) => t.name)).toEqual(['Copa HTTP']);
    expect((await call(`/public/tournaments/${slug}`, null)).status).toBe(404);
    expect((await call('/public/tournaments?status=nope', null)).status).toBe(400);
  });

  it('checks a registration live for a signed-in player', async () => {
    const id = tournaments.tournaments[0]?.id ?? '';
    tournaments.setStatus(id, 'registration_open');
    const response = await call(`/tournaments/${id}/registrations/check`, 'ana', {
      method: 'POST',
      body: JSON.stringify({ teamId: null, roster: [{ userId: ANA, role: 'starter' }] }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: false, blockers: ['team_required'] });
  });
});
