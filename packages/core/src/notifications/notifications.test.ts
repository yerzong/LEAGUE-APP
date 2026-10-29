import { describe, expect, it } from 'vitest';

import {
  decideChannels,
  isOptInCategory,
  nextAttemptAt,
  preferenceMatrix,
  renderTemplate,
  templateVariables,
  type NotificationTypeDef,
} from './notifications.js';

const approved: NotificationTypeDef = {
  key: 'registration.approved',
  category: 'tournaments',
  critical: false,
  defaultChannels: ['in_app', 'email', 'discord'],
};
const forfeit: NotificationTypeDef = {
  key: 'match.forfeit',
  category: 'matches',
  critical: true,
  defaultChannels: ['in_app', 'email', 'discord'],
};
const published: NotificationTypeDef = {
  key: 'tournament.published',
  category: 'announcements',
  critical: false,
  defaultChannels: ['in_app', 'email'],
};
const available = ['in_app', 'email'] as const;

describe('decideChannels', () => {
  it('uses the default channels the platform can send, in-app always', () => {
    expect(decideChannels({ type: approved, rule: null, preferences: [], available })).toEqual([
      'in_app',
      'email',
    ]);
  });

  it('follows the organization rule: its channels, or nothing when disabled', () => {
    expect(
      decideChannels({
        type: approved,
        rule: { enabled: true, channels: ['in_app'] },
        preferences: [],
        available,
      }),
    ).toEqual(['in_app']);
    expect(
      decideChannels({
        type: approved,
        rule: { enabled: false, channels: null },
        preferences: [],
        available,
      }),
    ).toEqual([]);
  });

  it('keeps in-app even when the rule leaves it out (it is the official history)', () => {
    expect(
      decideChannels({
        type: approved,
        rule: { enabled: true, channels: ['email'] },
        preferences: [],
        available,
      }),
    ).toEqual(['in_app', 'email']);
  });

  it('drops the channels the user turned off for the category', () => {
    expect(
      decideChannels({
        type: approved,
        rule: null,
        preferences: [{ category: 'tournaments', channel: 'email', enabled: false }],
        available,
      }),
    ).toEqual(['in_app']);
    // A preference of another category does not apply.
    expect(
      decideChannels({
        type: approved,
        rule: null,
        preferences: [{ category: 'matches', channel: 'email', enabled: false }],
        available,
      }),
    ).toEqual(['in_app', 'email']);
  });

  it('critical: the user cannot turn it off, it falls back to an allowed channel', () => {
    expect(
      decideChannels({
        type: forfeit,
        rule: null,
        preferences: [{ category: 'matches', channel: 'email', enabled: false }],
        available,
      }),
    ).toEqual(['in_app', 'email']);
  });

  it('critical: the user can move it to another channel', () => {
    expect(
      decideChannels({
        type: forfeit,
        rule: null,
        preferences: [
          { category: 'matches', channel: 'email', enabled: false },
          { category: 'matches', channel: 'discord', enabled: true },
        ],
        available: ['in_app', 'email', 'discord'],
      }),
    ).toEqual(['in_app', 'discord']);
  });

  it('critical: an organization cannot disable it', () => {
    expect(
      decideChannels({
        type: forfeit,
        rule: { enabled: false, channels: null },
        preferences: [],
        available,
      }),
    ).toEqual(['in_app', 'email']);
  });

  it('announcements are opt-in, in-app included', () => {
    expect(decideChannels({ type: published, rule: null, preferences: [], available })).toEqual([]);
    expect(
      decideChannels({
        type: published,
        rule: null,
        preferences: [{ category: 'announcements', channel: 'in_app', enabled: true }],
        available,
      }),
    ).toEqual(['in_app']);
  });
});

describe('preferenceMatrix', () => {
  it('lists each category with its channels, locking in-app outside opt-in categories', () => {
    const matrix = preferenceMatrix({
      types: [approved, forfeit, published],
      preferences: [{ category: 'tournaments', channel: 'email', enabled: false }],
      available,
    });
    expect(matrix).toEqual([
      {
        category: 'tournaments',
        optIn: false,
        hasCritical: false,
        channels: [
          { channel: 'in_app', enabled: true, locked: true },
          { channel: 'email', enabled: false, locked: false },
        ],
      },
      {
        category: 'matches',
        optIn: false,
        hasCritical: true,
        channels: [
          { channel: 'in_app', enabled: true, locked: true },
          { channel: 'email', enabled: true, locked: false },
        ],
      },
      {
        category: 'announcements',
        optIn: true,
        hasCritical: false,
        channels: [
          { channel: 'in_app', enabled: false, locked: false },
          { channel: 'email', enabled: false, locked: false },
        ],
      },
    ]);
  });

  it('knows the opt-in categories', () => {
    expect(isOptInCategory('announcements')).toBe(true);
    expect(isOptInCategory('marketing')).toBe(true);
    expect(isOptInCategory('matches')).toBe(false);
  });
});

describe('templates', () => {
  it('replaces the variables and reports the missing ones', () => {
    expect(
      renderTemplate('{{ entrant.name }} está dentro de {{tournament.name}}{{x}}', {
        entrant: { name: 'Jaguares' },
        tournament: { name: 'Liga Apertura' },
      }),
    ).toEqual({ text: 'Jaguares está dentro de Liga Apertura', missing: ['x'] });
  });

  it('renders numbers and leaves text without placeholders alone', () => {
    expect(renderTemplate('Ronda {{match.round}}', { match: { round: 3 } }).text).toBe('Ronda 3');
    expect(renderTemplate('Sin variables', {}).text).toBe('Sin variables');
  });

  it('does not read through objects or prototypes', () => {
    expect(renderTemplate('{{entrant}}|{{constructor.name}}', { entrant: { name: 'A' } })).toEqual({
      text: '|',
      missing: ['constructor.name', 'entrant'],
    });
  });

  it('lists the variables a template uses, sorted and unique', () => {
    expect(templateVariables('{{b.c}} {{ a }} {{b.c}} {{bad-name}}')).toEqual(['a', 'b.c']);
  });
});

describe('nextAttemptAt', () => {
  const now = new Date('2026-10-27T18:00:00Z');

  it('backs off exponentially from 30 s', () => {
    expect(nextAttemptAt(1, now)?.toISOString()).toBe('2026-10-27T18:00:30.000Z');
    expect(nextAttemptAt(2, now)?.toISOString()).toBe('2026-10-27T18:01:00.000Z');
    expect(nextAttemptAt(4, now)?.toISOString()).toBe('2026-10-27T18:04:00.000Z');
  });

  it('caps the delay at one hour and gives up after the last attempt', () => {
    expect(nextAttemptAt(9, now, 10)?.toISOString()).toBe('2026-10-27T19:00:00.000Z');
    expect(nextAttemptAt(6, now)).toBeNull();
  });
});
