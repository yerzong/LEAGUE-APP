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
  })
  .superRefine((env, ctx) => {
    if (env.RIOT_PROVIDER === 'riot' && !env.RIOT_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RIOT_API_KEY'],
        message: 'required when RIOT_PROVIDER=riot',
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
