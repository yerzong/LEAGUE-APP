import type { HealthResponse } from '@league/contracts';

import { resolveHealthStatus } from '../domain/health-status.js';
import type { Clock, HealthIndicator } from './ports.js';

export class GetHealthUseCase {
  constructor(
    private readonly clock: Clock,
    private readonly indicators: readonly HealthIndicator[],
    private readonly version: string,
  ) {}

  async execute(): Promise<HealthResponse> {
    const checks = await Promise.all(this.indicators.map((indicator) => indicator.check()));
    return {
      status: resolveHealthStatus(checks),
      version: this.version,
      timestamp: this.clock.now().toISOString(),
    };
  }
}
