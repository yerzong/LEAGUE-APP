/**
 * Sample content for the kitchen sink (a development page). This is demo data,
 * not product copy, so it lives here instead of the i18n catalog.
 */
export type Circuit = 'league' | 'ascenso' | 'flash' | 'femenil' | 'uni';

export interface DemoTeam {
  id: string;
  name: string;
  tag: string;
  circuit: Circuit;
  wins: number;
  losses: number;
}

const teamNames = [
  'Halcones',
  'Jaguares',
  'Ajolotes',
  'Coyotes',
  'Quetzales',
  'Lobos',
  'Águilas',
  'Tiburones',
  'Pumas',
  'Toros',
  'Colibríes',
  'Venados',
];
const circuits: Circuit[] = ['league', 'ascenso', 'flash', 'femenil', 'uni'];

export const demoTeams: DemoTeam[] = teamNames.map((name, index) => ({
  id: `team-${String(index + 1)}`,
  name,
  tag: name.normalize('NFD').replace(/\p{M}/gu, '').slice(0, 3).toUpperCase(),
  circuit: circuits[index % circuits.length] ?? 'league',
  wins: (index * 5) % 9,
  losses: (index * 3) % 7,
}));

export const circuitNames: Record<Circuit, string> = {
  league: 'Liga',
  ascenso: 'Ascenso',
  flash: 'Relámpago',
  femenil: 'Femenil',
  uni: 'Universitario',
};

export const demo = {
  roles: ['Top', 'Jungla', 'Mid', 'ADC', 'Support'],
  regions: ['LAN', 'LAS', 'NA'],
  mvp: { player: 'Faker', team: 'Halcones', kda: 'KDA 12 / 1 / 9', kp: '92% KP' },
} as const;
