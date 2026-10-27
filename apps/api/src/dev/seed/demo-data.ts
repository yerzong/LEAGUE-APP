// The demo scenario (docs/specs/m0dev): fictional players, teams and three
// tournaments. Everything carries the `demo` mark (names "demo: …",
// usernames "demo_…", emails "@demo.penta.local") so seed:reset finds it.
import {
  defaultPhase,
  DEFAULT_TOURNAMENT_CONFIG,
  type PlayerRole,
  type TournamentConfigInput,
} from '@league/contracts';

export const DEMO_EMAIL_DOMAIN = 'demo.penta.local';
export const DEMO_NAME_PREFIX = 'demo: ';
export const DEMO_USERNAME_PREFIX = 'demo_';
export const DEMO_STAFF_EMAIL = `demo-staff@${DEMO_EMAIL_DOMAIN}`;
/** Fictional accounts on the development project only; override with SEED_DEMO_PASSWORD. */
export const DEFAULT_DEMO_PASSWORD = 'Demo-penta-2026!';

export const isDemoEmail = (email: string | undefined): boolean =>
  email?.endsWith(`@${DEMO_EMAIL_DOMAIN}`) ?? false;

type Tier = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond' | 'master';

export interface DemoRank {
  tier: Tier;
  division: number | null;
  lp: number;
}

export interface DemoPlayer {
  key: string;
  email: string;
  username: string;
  displayName: string;
  countryCode: string;
  birthDate: string;
  primaryRole: PlayerRole;
  secondaryRole: PlayerRole | null;
  bio: string | null;
  riot: { gameName: string; tagLine: string; rank: DemoRank; level: number };
  /** Index in DEMO_TEAMS, or null for a free agent. */
  team: number | null;
}

export interface DemoTeam {
  name: string;
  tag: string;
  description: string;
  /** Placeholder logo colors (RGB), drawn by png.ts. */
  colors: readonly [readonly [number, number, number], readonly [number, number, number]];
}

const TEAMS: readonly Omit<DemoTeam, 'description'>[] = [
  {
    name: 'Jaguares',
    tag: 'DJAG',
    colors: [
      [214, 160, 32],
      [24, 24, 28],
    ],
  },
  {
    name: 'Quetzales',
    tag: 'DQTZ',
    colors: [
      [22, 150, 110],
      [200, 40, 60],
    ],
  },
  {
    name: 'Ajolotes',
    tag: 'DAJO',
    colors: [
      [240, 140, 170],
      [60, 40, 90],
    ],
  },
  {
    name: 'Coyotes',
    tag: 'DCOY',
    colors: [
      [150, 110, 70],
      [240, 230, 210],
    ],
  },
  {
    name: 'Halcones',
    tag: 'DHAL',
    colors: [
      [40, 80, 160],
      [230, 230, 240],
    ],
  },
  {
    name: 'Colibríes',
    tag: 'DCOL',
    colors: [
      [60, 200, 210],
      [120, 30, 140],
    ],
  },
  {
    name: 'Volcanes',
    tag: 'DVOL',
    colors: [
      [220, 70, 30],
      [40, 30, 30],
    ],
  },
  {
    name: 'Tiburones',
    tag: 'DTIB',
    colors: [
      [70, 90, 110],
      [250, 250, 250],
    ],
  },
];

export const DEMO_TEAMS: readonly DemoTeam[] = TEAMS.map((t) => ({
  ...t,
  name: `${DEMO_NAME_PREFIX}${t.name}`,
  description: `Equipo de demostración (${t.name}). Datos ficticios.`,
}));

const HANDLES = [
  'Tlaloc',
  'Nahual',
  'Xolo',
  'Pixca',
  'Tecolote',
  'Chamuco',
  'Quimera',
  'Zenzontle',
  'Mezcal',
  'Cenote',
  'Tamarindo',
  'Huracan',
  'Axolote',
  'Tepache',
  'Pirul',
  'Cacao',
  'Ocelote',
  'Copal',
  'Zarape',
  'Nopal',
  'Tejon',
  'Chile',
  'Mango',
  'Iguana',
  'Itzel',
  'Tonatiuh',
  'Citlali',
  'Yaretzi',
  'Teyo',
  'Mictlan',
  'Tuna',
  'Elote',
  'Garra',
  'Cometa',
  'Rayo',
  'Bruma',
  'Ceiba',
  'Jade',
  'Obsidiana',
  'Turquesa',
  'Ambar',
  'Cobre',
  'Marea',
  'Arrecife',
  'Coral',
  'Sargazo',
  'Delfin',
  'Manta',
  'Brujo',
  'Lince',
  'Puma',
  'Venado',
  'Tapir',
  'Zorro',
] as const;

const ROLES: readonly PlayerRole[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const COUNTRIES = ['MX', 'MX', 'MX', 'CO', 'AR', 'CL', 'PE', 'GT'] as const;

/** Team strength sets the ranks: the first teams are the strongest. */
const TEAM_TIERS: readonly Tier[] = [
  'diamond',
  'emerald',
  'emerald',
  'platinum',
  'platinum',
  'gold',
  'gold',
  'silver',
];
const FREE_AGENT_TIERS: readonly Tier[] = [
  'master',
  'diamond',
  'platinum',
  'gold',
  'silver',
  'bronze',
];

function rankOf(tier: Tier, i: number): DemoRank {
  return tier === 'master'
    ? { tier, division: null, lp: 120 + i * 7 }
    : { tier, division: (i % 4) + 1, lp: (i * 23) % 100 };
}

function player(i: number, team: number | null, slot: number, tier: Tier): DemoPlayer {
  const handle = HANDLES[i] ?? `Jugador${String(i)}`;
  const key = handle.toLowerCase();
  const primaryRole = ROLES[slot % 5] ?? 'mid';
  return {
    key,
    email: `demo-${key}@${DEMO_EMAIL_DOMAIN}`,
    username: `${DEMO_USERNAME_PREFIX}${key}`,
    displayName: handle,
    countryCode: COUNTRIES[i % COUNTRIES.length] ?? 'MX',
    birthDate: `${String(1996 + (i % 10))}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    primaryRole,
    secondaryRole: ROLES[(slot + 2) % 5] ?? null,
    bio: i % 3 === 0 ? 'Jugador de demostración. Datos ficticios.' : null,
    riot: { gameName: handle, tagLine: 'DEMO', rank: rankOf(tier, i), level: 60 + i * 9 },
    team,
  };
}

/**
 * 8 teams of 5 starters + 1 substitute (48 players) and 6 free agents. Teams
 * need their own players: the same player cannot be on two rosters of the
 * flash tournament (anti-chapulineo).
 */
export const DEMO_PLAYERS: readonly DemoPlayer[] = [
  ...DEMO_TEAMS.flatMap((_, team) =>
    Array.from({ length: 6 }, (_, slot) => {
      // The Jaguares' star is Master: the open tournament (Diamond I max) rejects that roster.
      const tier = team === 0 && slot === 2 ? 'master' : (TEAM_TIERS[team] ?? 'gold');
      return player(team * 6 + slot, team, slot, tier);
    }),
  ),
  ...FREE_AGENT_TIERS.map((tier, i) => player(48 + i, null, i, tier)),
];

export const captainOf = (team: number): DemoPlayer => {
  const found = DEMO_PLAYERS.find((p) => p.team === team);
  if (!found) throw new Error(`Demo team ${String(team)} has no players`);
  return found;
};

export const membersOf = (team: number): DemoPlayer[] =>
  DEMO_PLAYERS.filter((p) => p.team === team);

export const DEMO_SEASON = { name: `${DEMO_NAME_PREFIX}Temporada 2026` };
export const DEMO_CIRCUIT = { name: `${DEMO_NAME_PREFIX}Circuito Relámpago` };

const DAY = 86_400_000;
const iso = (from: Date, days: number) => new Date(from.getTime() + days * DAY).toISOString();

export type DemoTournamentKey = 'flash' | 'league' | 'open';

export interface DemoTournament {
  key: DemoTournamentKey;
  name: string;
  /** Teams (indexes in DEMO_TEAMS) that register. */
  teams: readonly number[];
  /** Approved among `teams`; the rest stay pending. */
  approved: readonly number[];
  config: (now: Date, ids: { seasonId: string; circuitId: string }) => TournamentConfigInput;
}

const base = DEFAULT_TOURNAMENT_CONFIG;

const rulebook =
  'Reglamento de demostración.\n\n1. Partidas 5v5 en la Grieta del Invocador.\n2. Check-in 30 minutos antes.\n3. Ambos capitanes reportan el resultado.';

export const DEMO_RULEBOOK = { title: 'Reglamento demo', content: rulebook, changeSummary: null };

export const DEMO_TOURNAMENTS: readonly DemoTournament[] = [
  {
    key: 'flash',
    name: `${DEMO_NAME_PREFIX}Copa Relámpago`,
    teams: [0, 1, 2, 3, 4, 5, 6, 7],
    approved: [0, 1, 2, 3, 4, 5, 6, 7],
    config: (now, ids) => ({
      ...base,
      basics: {
        ...base.basics,
        name: `${DEMO_NAME_PREFIX}Copa Relámpago`,
        type: 'flash',
        description: 'Torneo relámpago de demostración: 8 equipos, eliminación directa.',
        seasonId: ids.seasonId,
      },
      capacity: { capacity: 8, waitlistEnabled: true },
      eligibility: { ...base.eligibility, circuitId: ids.circuitId },
      roster: { ...base.roster, maxSubstitutes: 1, coachAllowed: false },
      format: {
        seedingMethod: 'random',
        phases: [
          {
            ...defaultPhase('single_elimination', 'Eliminación directa'),
            seriesFormat: 'bo1',
            finalSeriesFormat: 'bo3',
          },
        ],
      },
      schedule: {
        ...base.schedule,
        registrationOpensAt: iso(now, -1),
        registrationClosesAt: iso(now, 3),
        startsAt: iso(now, 4),
        windows: [6, 0].map((weekday) => ({
          weekday,
          startTime: '16:00',
          endTime: '22:00',
          slotMinutes: 60,
          parallelMatches: 4,
        })),
      },
    }),
  },
  {
    key: 'league',
    name: `${DEMO_NAME_PREFIX}Liga Apertura`,
    teams: [0, 1, 2, 3, 4, 5],
    approved: [0, 1, 2, 3, 4, 5],
    config: (now, ids) => ({
      ...base,
      basics: {
        ...base.basics,
        name: `${DEMO_NAME_PREFIX}Liga Apertura`,
        type: 'league',
        tier: 2,
        description: 'Liga de demostración: 6 equipos, todos contra todos, una jornada por semana.',
        seasonId: ids.seasonId,
      },
      capacity: { capacity: 6, waitlistEnabled: false },
      roster: { ...base.roster, maxSubstitutes: 1, coachAllowed: false },
      format: {
        seedingMethod: 'random',
        phases: [{ ...defaultPhase('round_robin', 'Temporada regular'), seriesFormat: 'bo3' }],
      },
      schedule: {
        ...base.schedule,
        registrationOpensAt: iso(now, -1),
        registrationClosesAt: iso(now, 1),
        startsAt: iso(now, 1),
        // One round per week: a 3-hour slot fits the three matches of a round.
        windows: [
          {
            weekday: 6,
            startTime: '18:00',
            endTime: '21:00',
            slotMinutes: 180,
            parallelMatches: 3,
          },
        ],
      },
    }),
  },
  {
    key: 'open',
    name: `${DEMO_NAME_PREFIX}Torneo Abierto`,
    teams: [6, 7],
    approved: [6],
    config: (now, ids) => ({
      ...base,
      basics: {
        ...base.basics,
        name: `${DEMO_NAME_PREFIX}Torneo Abierto`,
        type: 'flash',
        description: 'Inscripciones abiertas (demo). Máximo Diamante I por jugador.',
        seasonId: ids.seasonId,
      },
      capacity: { capacity: 16, waitlistEnabled: true },
      eligibility: {
        ...base.eligibility,
        circuitId: ids.circuitId,
        rules: [
          ...base.eligibility.rules,
          {
            type: 'rank_max',
            params: { rank: { tier: 'diamond', division: 1 } },
            appliesTo: 'player',
          },
        ],
      },
      roster: { ...base.roster, maxSubstitutes: 1, coachAllowed: false },
      schedule: {
        ...base.schedule,
        registrationOpensAt: iso(now, -1),
        registrationClosesAt: iso(now, 10),
        startsAt: iso(now, 12),
        windows: [
          { weekday: 6, startTime: '16:00', endTime: '22:00', slotMinutes: 60, parallelMatches: 4 },
        ],
      },
    }),
  },
];

/**
 * League results: the stronger team (lower index) wins, with an upset now and
 * then so points tie and the tiebreakers show. Returns games for Bo3.
 */
export function leagueGames(teamA: number, teamB: number, round: number) {
  const upset = (teamA + teamB + round) % 4 === 0;
  const aWins = teamA < teamB !== upset;
  const close = Math.abs(teamA - teamB) < 3 || upset;
  const winner = aWins ? ('a' as const) : ('b' as const);
  const loser = aWins ? ('b' as const) : ('a' as const);
  const winners = close ? [winner, loser, winner] : [winner, winner];
  return winners.map((w, i) => ({ number: i + 1, winner: w }));
}

/** How many league rounds the seed plays (of five). */
export const LEAGUE_ROUNDS_PLAYED = 3;
/** The league "started" this long ago: rounds 1–3 fall on the last three Saturdays. */
export const LEAGUE_STARTED_DAYS_AGO = 22;
