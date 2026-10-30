// A small league for the stats use cases: two teams of five with Riot
// accounts, one bo3 played 2–1 with Match-V5 data, and the fakes around it.
import { StaticChampionCatalog } from '@league/integrations';

import { demoMatchData } from '../../../dev/seed/match-data.js';
import type { Profile, ResolvedPrivacy } from '../../identity/domain/profile.js';
import type { MemberRecord, TeamRecord } from '../../teams/domain/team.js';
import type { StatsDeps } from '../application/deps.js';
import type { AchievementRecord, StatsMatch } from '../application/ports.js';
import { InMemoryFollowRepository, InMemoryStatsRepository } from './in-memory-stats.js';

export const ORG = 'org-1';
export const TOURNAMENT = '00000000-0000-4000-8000-0000000000a1';
export const PHASE = '00000000-0000-4000-8000-0000000000b1';
export const STAFF = 'staff';
const PUBLIC: ResolvedPrivacy = {
  country: 'public',
  game_region: 'public',
  roles: 'public',
  bio: 'public',
  riot_account: 'public',
  teams: 'public',
  age: 'public',
};

const teamPlayers = (team: 'a' | 'b') => [1, 2, 3, 4, 5].map((i) => `${team}${String(i)}`);
export const PLAYERS = { a: teamPlayers('a'), b: teamPlayers('b') };
export const puuidOf = (userId: string) => `puuid-${userId}`;

export const BASE_ACHIEVEMENTS: AchievementRecord[] = [
  {
    id: 'ach-first-win',
    organizationId: null,
    key: 'first_win',
    name: 'Primera victoria',
    description: 'Gana tu primer game oficial.',
    icon: 'trophy',
    criteria: { type: 'games', gte: 1, wins: true },
    active: true,
    position: 10,
  },
  {
    id: 'ach-games-3',
    organizationId: null,
    key: 'games_3',
    name: 'Tres games',
    description: 'Juega 3 games.',
    icon: 'shield',
    criteria: { type: 'games', gte: 3 },
    active: true,
    position: 20,
  },
  {
    id: 'ach-penta',
    organizationId: null,
    key: 'first_pentakill',
    name: 'Pentakill',
    description: 'Un pentakill.',
    icon: 'swords',
    criteria: { type: 'game', conditions: [{ stat: 'pentaKills', gte: 1 }] },
    active: false,
    position: 30,
  },
];

export interface StatsFixture {
  readonly deps: StatsDeps;
  readonly stats: InMemoryStatsRepository;
  readonly follows: InMemoryFollowRepository;
  readonly privacy: Map<string, ResolvedPrivacy>;
  readonly profiles: Map<string, Profile>;
  /** Adds a closed bo3 between the teams, with match data for the games in `withData`. */
  playMatch(options: {
    id: string;
    round: number;
    winner: 'a' | 'b';
    games: readonly ('a' | 'b')[];
    withData?: boolean;
    status?: string;
  }): StatsMatch;
}

const profile = (id: string, platformRole: Profile['platformRole'] = 'user'): Profile => ({
  id,
  username: `user_${id}`,
  displayName: `Jugador ${id.toUpperCase()}`,
  avatarPath: null,
  countryCode: 'MX',
  gameRegion: 'la1',
  birthDate: '2000-01-01',
  primaryRole: 'mid',
  secondaryRole: null,
  bio: null,
  isFreeAgent: false,
  platformRole,
});

const team = (key: 'a' | 'b'): TeamRecord => ({
  id: `team-${key}`,
  organizationId: ORG,
  slug: `equipo-${key}`,
  name: key === 'a' ? 'Aurora' : 'Boreal',
  tag: key === 'a' ? 'AUR' : 'BOR',
  region: 'la1',
  description: null,
  logoPath: null,
  status: 'active',
  ownerUserId: `${key}1`,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

export function statsFixture(): StatsFixture {
  const stats = new InMemoryStatsRepository();
  const follows = new InMemoryFollowRepository();
  const profiles = new Map<string, Profile>(
    [...PLAYERS.a, ...PLAYERS.b, 'fan'].map((id) => [id, profile(id)]),
  );
  profiles.set(STAFF, { ...profile(STAFF, 'super_admin'), username: null });
  const privacy = new Map([...profiles.keys()].map((id) => [id, { ...PUBLIC }]));
  const teams = new Map([team('a'), team('b')].map((t) => [t.id, t]));

  stats.tournamentList.set(TOURNAMENT, {
    id: TOURNAMENT,
    organizationId: ORG,
    slug: 'liga',
    name: 'Liga',
    status: 'in_progress',
    seasonId: 'season-1',
    circuitId: null,
    isPublic: true,
  });
  stats.phases.set(PHASE, 'Fase regular');
  for (const key of ['a', 'b'] as const)
    stats.entrantList.set(`entrant-${key}`, {
      id: `entrant-${key}`,
      name: team(key).name,
      teamId: `team-${key}`,
      userIds: PLAYERS[key],
    });
  for (const id of [...PLAYERS.a, ...PLAYERS.b])
    stats.accounts.set(puuidOf(id), { userId: id, riotAccountId: `riot-${id}` });
  stats.achievementList = [...BASE_ACHIEVEMENTS];

  const deps: StatsDeps = {
    stats,
    follows,
    champions: new StaticChampionCatalog(),
    profiles: {
      findById: (id) => Promise.resolve(profiles.get(id) ?? null),
      findByUsername: (username) =>
        Promise.resolve([...profiles.values()].find((p) => p.username === username) ?? null),
      privacyOf: (ids) =>
        Promise.resolve(
          new Map(
            ids.flatMap((id) => {
              const p = privacy.get(id);
              return p ? [[id, p] as const] : [];
            }),
          ),
        ),
      summaries: (ids) =>
        Promise.resolve(
          new Map(
            ids.flatMap((id) => {
              const p = profiles.get(id);
              return p
                ? [
                    [
                      id,
                      { username: p.username, displayName: p.displayName, avatarUrl: null },
                    ] as const,
                  ]
                : [];
            }),
          ),
        ),
      isStaff: (id) => Promise.resolve(profiles.get(id)?.platformRole === 'super_admin'),
    },
    teams: {
      findById: (id) => Promise.resolve(teams.get(id) ?? null),
      findBySlug: (slug) =>
        Promise.resolve([...teams.values()].find((t) => t.slug === slug) ?? null),
      activeMembers: (teamId) =>
        Promise.resolve(
          (teamId === 'team-a' ? PLAYERS.a : PLAYERS.b).map((userId, i): MemberRecord => ({
            userId,
            teamRole: i === 0 ? 'captain' : 'player',
            gameRole: null,
            joinedAt: new Date('2026-01-01T00:00:00Z'),
          })),
        ),
      logoUrl: () => null,
    },
    organization: { id: () => Promise.resolve(ORG) },
    clock: { now: () => new Date('2026-10-24T22:00:00Z') },
    settings: { batchSize: 10 },
  };

  return {
    deps,
    stats,
    follows,
    privacy,
    profiles,
    playMatch({ id, round, winner, games, withData = true, status = 'completed' }) {
      const match: StatsMatch = {
        id,
        tournamentId: TOURNAMENT,
        phaseId: PHASE,
        round,
        status,
        entrantA: 'entrant-a',
        entrantB: 'entrant-b',
        winnerId: status === 'completed' ? `entrant-${winner}` : null,
        scoreA: games.filter((g) => g === 'a').length,
        scoreB: games.filter((g) => g === 'b').length,
        finalizedAt: new Date(`2026-10-${String(10 + round)}T22:00:00Z`),
      };
      stats.matches.push(match);
      games.forEach((w, i) => {
        // Sides alternate, as m05 writes them.
        const blue = i % 2 === 0 ? 'a' : 'b';
        const red = blue === 'a' ? 'b' : 'a';
        const endedAt = new Date(`2026-10-${String(10 + round)}T2${String(i)}:00:00Z`);
        stats.gamesList.push({
          id: `${id}-g${String(i + 1)}`,
          matchId: id,
          number: i + 1,
          status: status === 'completed' ? 'completed' : 'pending',
          blueEntrantId: `entrant-${blue}`,
          redEntrantId: `entrant-${red}`,
          winnerEntrantId: status === 'completed' ? `entrant-${w}` : null,
          endedAt,
          durationSeconds: null,
          payload: withData
            ? demoMatchData({
                key: `${id}-${String(i)}`,
                blue: PLAYERS[blue].map(puuidOf),
                red: PLAYERS[red].map(puuidOf),
                blueWins: w === blue,
                endedAt,
              })
            : null,
        });
      });
      if (status === 'completed') stats.request(id, `2026-10-${String(10 + round)}T22:00:00.000Z`);
      return match;
    },
  };
}
