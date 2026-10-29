import { z } from 'zod';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    APP_VERSION: z.string().min(1).default('0.0.0'),
    // Supabase project used to verify access tokens (publishable key: safe outside the browser too).
    SUPABASE_URL: z.url(),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    // Secret (service role) key: business writes. Server side only, never logged.
    SUPABASE_SECRET_KEY: z.string().min(1),
    // Tenant used until requests carry their organization.
    DEFAULT_ORGANIZATION_SLUG: z.string().min(1).default('penta-league'),
    // `stub` never calls Riot (tests, E2E, local without a key).
    RIOT_PROVIDER: z.enum(['riot', 'stub']).default('stub'),
    RIOT_API_KEY: z.string().min(1).optional(),
    // Seconds between check-in sweeps (open and close windows, forfeits); 0 turns it off.
    CHECKIN_SWEEP_SECONDS: z.coerce.number().int().min(0).max(3600).default(60),
    // Seconds between notification passes (outbox → notifications, queued deliveries); 0 turns it off.
    NOTIFICATIONS_POLL_SECONDS: z.coerce.number().int().min(0).max(3600).default(5),
    // Events older than this are consumed without notifying (a stale check-in is noise).
    NOTIFICATIONS_MAX_EVENT_AGE_HOURS: z.coerce.number().int().min(1).max(720).default(48),
    // Seconds between stats passes (closed matches → stats, MVPs, achievements); 0 turns it off.
    STATS_POLL_SECONDS: z.coerce.number().int().min(0).max(3600).default(5),
    // Champion names and icons: Data Dragon (static Riot assets) or a built-in list (tests, offline).
    CHAMPIONS_PROVIDER: z.enum(['ddragon', 'static']).default('ddragon'),
    // `fake` keeps emails in memory (tests, CI, local without a key); `resend` sends them.
    EMAIL_PROVIDER: z.enum(['resend', 'fake']).default('fake'),
    RESEND_API_KEY: z.string().min(1).optional(),
    // `Name <address>` of a domain verified in the provider.
    EMAIL_FROM: z.string().min(3).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.RIOT_PROVIDER === 'riot' && !env.RIOT_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RIOT_API_KEY'],
        message: 'required when RIOT_PROVIDER=riot',
      });
    }
    if (env.EMAIL_PROVIDER === 'resend') {
      for (const name of ['RESEND_API_KEY', 'EMAIL_FROM'] as const)
        if (!env[name])
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: 'required when EMAIL_PROVIDER=resend',
          });
    }
    if (env.NODE_ENV === 'production' && env.EMAIL_PROVIDER === 'fake') {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'the fake email adapter is not allowed in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.RIOT_PROVIDER === 'stub') {
      ctx.addIssue({
        code: 'custom',
        path: ['RIOT_PROVIDER'],
        message: 'the stub is not allowed in production',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export const ENV = Symbol('ENV');

/** Parses the environment or throws listing every invalid variable (names only, never values). */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment variables:\n  ${problems.join('\n  ')}`);
  }
  return result.data;
}
