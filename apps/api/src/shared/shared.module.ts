import { Global, Module } from '@nestjs/common';

import { ENV, type Env } from '../config/env.js';
import { CLOCK, systemClock } from './clock.js';
import { createAdminClient, SUPABASE_ADMIN, type AdminClient } from './database/supabase-admin.js';
import { CURRENT_ORGANIZATION, SlugOrganization } from './organization.js';
import { IMAGE_STORAGE, SupabaseImageStorage } from './storage/image-storage.js';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useValue: systemClock },
    {
      provide: SUPABASE_ADMIN,
      inject: [ENV],
      useFactory: (env: Env) => createAdminClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
    },
    {
      provide: IMAGE_STORAGE,
      inject: [SUPABASE_ADMIN, ENV],
      useFactory: (client: AdminClient, env: Env) =>
        new SupabaseImageStorage(client, env.SUPABASE_URL),
    },
    {
      provide: CURRENT_ORGANIZATION,
      inject: [SUPABASE_ADMIN, ENV],
      useFactory: (client: AdminClient, env: Env) =>
        new SlugOrganization(client, env.DEFAULT_ORGANIZATION_SLUG),
    },
  ],
  exports: [CLOCK, SUPABASE_ADMIN, IMAGE_STORAGE, CURRENT_ORGANIZATION],
})
export class SharedModule {}
