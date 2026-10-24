import 'reflect-metadata';

import { MeResponseSchema } from '@league/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module.js';
import { testEnv } from '../../../config/test-env.js';
import { ACCESS_TOKEN_VERIFIER, type AccessTokenVerifier } from '../application/ports.js';

const ana = { id: '01920000-0000-7000-8000-00000000000a', email: 'ana@test.local' };

const fakeVerifier: AccessTokenVerifier = {
  verify: (token) => Promise.resolve(token === 'valid-token' ? ana : null),
};

describe('GET /me', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(testEnv())],
    })
      .overrideProvider(ACCESS_TOKEN_VERIFIER)
      .useValue(fakeVerifier)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const getMe = (headers: Record<string, string> = {}) => fetch(`${baseUrl}/me`, { headers });

  it('responds 401 without a token', async () => {
    expect((await getMe()).status).toBe(401);
  });

  it('responds 401 when the header is not a bearer token', async () => {
    expect((await getMe({ authorization: 'Basic valid-token' })).status).toBe(401);
  });

  it('responds 401 with an invalid token', async () => {
    expect((await getMe({ authorization: 'Bearer forged' })).status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const response = await getMe({ authorization: 'Bearer valid-token' });

    expect(response.status).toBe(200);
    expect(MeResponseSchema.parse(await response.json())).toEqual(ana);
  });
});
