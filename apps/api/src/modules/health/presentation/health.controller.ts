import { HealthResponseSchema, type HealthResponse } from '@league/contracts';
import { Controller, Get, Inject } from '@nestjs/common';

import { GetHealthUseCase } from '../application/get-health.use-case.js';

@Controller('health')
export class HealthController {
  // Explicit tokens: dev (tsx) and tests do not emit decorator metadata.
  constructor(@Inject(GetHealthUseCase) private readonly getHealth: GetHealthUseCase) {}

  @Get()
  async get(): Promise<HealthResponse> {
    return HealthResponseSchema.parse(await this.getHealth.execute());
  }
}
