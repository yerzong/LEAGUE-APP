import { Module } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { GetHealthUseCase } from './application/get-health.use-case.js';
import { CLOCK, HEALTH_INDICATORS, type Clock, type HealthIndicator } from './application/ports.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { HealthController } from './presentation/health.controller.js';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    // Dependency indicators (database, queue) are added here as those modules arrive.
    { provide: HEALTH_INDICATORS, useValue: [] satisfies HealthIndicator[] },
    {
      provide: GetHealthUseCase,
      inject: [CLOCK, HEALTH_INDICATORS, ENV],
      useFactory: (clock: Clock, indicators: HealthIndicator[], env: Env) =>
        new GetHealthUseCase(clock, indicators, env.APP_VERSION),
    },
  ],
})
export class HealthModule {}
