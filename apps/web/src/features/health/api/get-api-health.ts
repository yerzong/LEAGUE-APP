import { HealthResponseSchema, type HealthStatus } from '@league/contracts';

export type ApiHealth = HealthStatus | 'unreachable';

/** Calls GET /health. Any network, HTTP or contract failure means "unreachable". */
export async function getApiHealth(
  apiUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<ApiHealth> {
  try {
    const response = await fetchFn(new URL('/health', apiUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return 'unreachable';
    const parsed = HealthResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.status : 'unreachable';
  } catch {
    return 'unreachable';
  }
}
