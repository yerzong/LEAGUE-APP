import type { MetadataRoute } from 'next';

import { publicEnv } from '@/config/public-env';
import { listPublicPlayers, listPublicTeams } from '@/features/site/api';
import { legalDocs } from '@/features/site/legal';
import { listPublicTournaments } from '@/features/tournaments/api';

// Rebuilt at most once an hour; the API may be down at build time.
export const revalidate = 3600;

const STATIC_PATHS = ['/', '/torneos', '/equipos', '/jugadores', '/patrocinadores', '/legal'];
/** Enough for the pilot; split into several sitemaps when the league grows. */
const MAX_ENTRIES = 100;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
  const query = { q: '', page: 1, pageSize: MAX_ENTRIES };
  const [teams, players, tournaments] = await Promise.all([
    listPublicTeams(query),
    listPublicPlayers(query),
    listPublicTournaments('all', 1, MAX_ENTRIES),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({ url: url(path) })),
    ...legalDocs.map((doc) => ({ url: url(`/legal/${doc.slug}`) })),
    ...(tournaments.ok
      ? tournaments.data.items.map((t) => ({ url: url(`/torneos/${t.slug}`) }))
      : []),
    ...(teams.ok ? teams.data.items.map((team) => ({ url: url(`/equipos/${team.slug}`) })) : []),
    ...(players.ok
      ? players.data.items.map((player) => ({ url: url(`/jugadores/${player.username}`) }))
      : []),
  ];
}
