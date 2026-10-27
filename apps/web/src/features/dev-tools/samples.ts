// Example values for the autofill buttons. Fictional, valid against the same
// contracts as the forms, and random enough not to collide (usernames, names).
import {
  defaultPhase,
  DEFAULT_TOURNAMENT_CONFIG,
  type CreateTeamInput,
  type TournamentConfigInput,
  type UpdateProfileInput,
} from '@league/contracts';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'.split(/(?:)/u);

const pick = <T>(list: readonly T[], random: () => number): T =>
  list[Math.floor(random() * list.length)] ?? (list[0] as T);
const suffix = (random: () => number) =>
  Array.from({ length: 4 }, () => pick(ALPHABET, random)).join('');

const HANDLES = ['Nahual', 'Xolo', 'Tecolote', 'Cenote', 'Ocelote', 'Zenzontle', 'Copal', 'Ceiba'];
const ANIMALS = ['Jaguares', 'Ajolotes', 'Halcones', 'Coyotes', 'Quetzales', 'Colibríes'];
const ROLES = ['top', 'jungle', 'mid', 'adc', 'support'] as const;

export function sampleProfile(random: () => number = Math.random): UpdateProfileInput {
  const handle = pick(HANDLES, random);
  const primary = Math.floor(random() * ROLES.length);
  return {
    displayName: handle,
    username: `${handle.toLowerCase()}_${suffix(random)}`,
    countryCode: 'MX',
    gameRegion: 'la1',
    birthDate: '2001-05-14',
    primaryRole: ROLES[primary] ?? 'mid',
    secondaryRole: ROLES[(primary + 2) % ROLES.length] ?? null,
    bio: 'Perfil de ejemplo para probar la plataforma.',
  };
}

export function sampleTeam(random: () => number = Math.random): CreateTeamInput {
  const s = suffix(random);
  return {
    name: `${pick(ANIMALS, random)} ${s}`,
    tag: `E${s.toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`.slice(0, 5),
    region: 'la1',
    description: 'Equipo de ejemplo para probar la plataforma.',
  };
}

const DAY = 86_400_000;

/** A flash tournament ready to publish: dates from `now`, weekend windows, rulebook-free. */
export function sampleTournament(
  now: Date = new Date(),
  random: () => number = Math.random,
): TournamentConfigInput {
  const base = DEFAULT_TOURNAMENT_CONFIG;
  const at = (days: number) => new Date(now.getTime() + days * DAY).toISOString();
  return {
    ...base,
    basics: {
      ...base.basics,
      name: `Copa de ejemplo ${suffix(random).toUpperCase()}`,
      description: 'Torneo relámpago de ejemplo: 8 equipos, eliminación directa, Bo1 y final Bo3.',
    },
    capacity: { capacity: 8, waitlistEnabled: true },
    roster: { ...base.roster, maxSubstitutes: 1 },
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
      registrationOpensAt: at(1),
      registrationClosesAt: at(7),
      startsAt: at(8),
      endsAt: at(9),
      windows: [6, 0].map((weekday) => ({
        weekday,
        startTime: '16:00',
        endTime: '22:00',
        slotMinutes: 60,
        parallelMatches: 4,
      })),
    },
  };
}
