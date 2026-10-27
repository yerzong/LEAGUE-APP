// Development tools (docs/specs/m0dev) show only with NEXT_PUBLIC_DEV_TOOLS=true
// AND the app pointing at the development project penta-dev: a production
// build stays clean even if someone sets the flag by mistake.

/** The only Supabase project dev tools run against (CLAUDE.md: penta-dev). */
export const DEV_PROJECT_REF = 'tcxqywnpytfrytpsqiln';

export function devToolsEnabled(
  flag: string | undefined,
  supabaseUrl: string | undefined,
): boolean {
  if (flag !== 'true' || !supabaseUrl) return false;
  try {
    const { protocol, hostname } = new URL(supabaseUrl);
    return protocol === 'https:' && hostname === `${DEV_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}
