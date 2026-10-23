export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheckResult {
  name: string;
  healthy: boolean;
}

/** All checks healthy → ok; some failing → degraded; all failing → down. No checks → ok. */
export function resolveHealthStatus(checks: readonly HealthCheckResult[]): HealthStatus {
  const failing = checks.filter((check) => !check.healthy).length;
  if (failing === 0) return 'ok';
  return failing === checks.length ? 'down' : 'degraded';
}
