import { HealthResponseSchema } from '@league/contracts';
import { describe, expect, it } from 'vitest';

import { GetHealthUseCase } from './get-health.use-case.js';
import type { Clock, HealthIndicator } from './ports.js';

const fixedClock: Clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };

const indicator = (healthy: boolean): HealthIndicator => ({
  check: () => Promise.resolve({ name: 'fake', healthy }),
});

describe('GetHealthUseCase', () => {
  it('reports ok with version and timestamp when all indicators are healthy', async () => {
    const useCase = new GetHealthUseCase(fixedClock, [indicator(true)], '1.2.3');

    await expect(useCase.execute()).resolves.toEqual({
      status: 'ok',
      version: '1.2.3',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('reports degraded when an indicator fails', async () => {
    const useCase = new GetHealthUseCase(fixedClock, [indicator(true), indicator(false)], '1.2.3');

    expect((await useCase.execute()).status).toBe('degraded');
  });

  it('returns a response that satisfies the shared contract', async () => {
    const useCase = new GetHealthUseCase(fixedClock, [], '1.2.3');

    expect(HealthResponseSchema.safeParse(await useCase.execute()).success).toBe(true);
  });
});
