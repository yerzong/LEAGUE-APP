// The demo seed writes to a real Supabase project. It only ever runs against
// the development project penta-dev, with an explicit opt-in, and never with
// NODE_ENV=production (docs/specs/m0dev).

/** The only project the seed may touch (CLAUDE.md: penta-dev). */
export const DEV_PROJECT_REF = 'tcxqywnpytfrytpsqiln';

export class SeedRefusedError extends Error {
  constructor(reason: string) {
    super(`Seed refused: ${reason}`);
    this.name = 'SeedRefusedError';
  }
}

/** Project ref of a hosted Supabase URL (`https://<ref>.supabase.co`), or null. */
export function projectRefOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol, hostname } = new URL(url);
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(hostname);
    return protocol === 'https:' && match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
}

/** Throws unless every condition holds; names variables, never prints values. */
export function assertSeedAllowed(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === 'production') throw new SeedRefusedError('NODE_ENV is production');
  if (env.SEED_ENABLED !== 'true') throw new SeedRefusedError('set SEED_ENABLED=true to run it');
  if (projectRefOf(env.SUPABASE_URL) !== DEV_PROJECT_REF)
    throw new SeedRefusedError('SUPABASE_URL is not the penta-dev project');
  if (!env.SUPABASE_SECRET_KEY) throw new SeedRefusedError('SUPABASE_SECRET_KEY is missing');
}
