import { Global, Module } from '@nestjs/common';

import { ENV, type Env } from '../../config/env.js';
import { ACCESS_TOKEN_VERIFIER } from './application/ports.js';
import { SupabaseAccessTokenVerifier } from './infrastructure/supabase-access-token-verifier.js';
import { AccessTokenGuard, OptionalAccessTokenGuard } from './presentation/access-token.guard.js';

/** Token verification and guards, available to every module. */
@Global()
@Module({
  providers: [
    {
      provide: ACCESS_TOKEN_VERIFIER,
      inject: [ENV],
      useFactory: (env: Env) =>
        new SupabaseAccessTokenVerifier(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY),
    },
    AccessTokenGuard,
    OptionalAccessTokenGuard,
  ],
  exports: [ACCESS_TOKEN_VERIFIER, AccessTokenGuard, OptionalAccessTokenGuard],
})
export class AuthModule {}
