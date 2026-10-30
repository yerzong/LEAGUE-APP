import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env));
  // A Match-V5 payload (m09) is larger than the default 100 kB.
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({ origin: env.WEB_ORIGIN });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}

await bootstrap();
