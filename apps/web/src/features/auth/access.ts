export type ProtectedZone = 'portal' | 'admin';

export type ZoneDecision = 'allow' | 'login' | 'forbidden';

const zonePrefixes: readonly [string, ProtectedZone][] = [
  ['/app', 'portal'],
  ['/admin', 'admin'],
];

export function protectedZoneOf(pathname: string): ProtectedZone | null {
  for (const [prefix, zone] of zonePrefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return zone;
  }
  return null;
}

/** /app needs a session; /admin also needs the super_admin platform role. */
export function decideZoneAccess(
  zone: ProtectedZone,
  session: { authenticated: boolean; isSuperAdmin: boolean },
): ZoneDecision {
  if (!session.authenticated) return 'login';
  if (zone === 'admin' && !session.isSuperAdmin) return 'forbidden';
  return 'allow';
}

/**
 * Post-login destination from untrusted input. Only same-site absolute paths are
 * accepted, so `next` cannot become an open redirect.
 */
export function safeNextPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}

export function loginPath(next: string): string {
  return `/login?${new URLSearchParams({ next }).toString()}`;
}
