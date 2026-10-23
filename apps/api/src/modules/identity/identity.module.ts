import { Module } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { ACCESS_TOKEN_VERIFIER } from './application/ports.js';
import { SupabaseAccessTokenVerifier } from './infrastructure/supabase-access-token-verifier.js';
import { AccessTokenGuard } from './presentation/access-token.guard.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [MeController],
  providers: [
    {
      provide: ACCESS_TOKEN_VERIFIER,
      inject: [ENV],
      useFactory: (env: Env) =>
        new SupabaseAccessTokenVerifier(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY),
    },
    AccessTokenGuard,
  ],
  exports: [ACCESS_TOKEN_VERIFIER, AccessTokenGuard],
})
export class IdentityModule {}
