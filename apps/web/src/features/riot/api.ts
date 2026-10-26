import 'server-only';

import { MyRiotAccountResponseSchema } from '@league/contracts';
import { z } from 'zod';

import { apiRequest } from '@/lib/api/server-client';

export const getMyRiotAccount = () =>
  apiRequest('/me/riot-account', { schema: MyRiotAccountResponseSchema });

const VersionsSchema = z.array(z.string()).min(1);

/** Latest Data Dragon version (for profile icon images); null when Riot's CDN is unreachable. */
export async function getDataDragonVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(3000),
    });
    const parsed = VersionsSchema.safeParse(await response.json());
    return parsed.success ? (parsed.data[0] ?? null) : null;
  } catch {
    return null;
  }
}
