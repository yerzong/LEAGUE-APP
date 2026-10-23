import 'reflect-metadata';

import { HealthResponseSchema } from '@league/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module.js';
import { loadEnv } from '../../../config/env.js';

describe('GET /health', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(loadEnv({ APP_VERSION: '9.9.9' }))],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds 200 with a HealthResponse', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    const body = HealthResponseSchema.parse(await response.json());
    expect(body).toMatchObject({ status: 'ok', version: '9.9.9' });
  });
});
