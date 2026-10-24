import { type DynamicModule, Module } from '@nestjs/common';

import { ENV, type Env } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';

@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [HealthModule, IdentityModule],
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}
