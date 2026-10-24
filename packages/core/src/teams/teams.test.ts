import { describe, expect, it } from 'vitest';

import { TeamRuleError } from '../errors.js';
import {
  assertCanChangeRole,
  assertCanCreateTeam,
  assertCanJoin,
  assertCanLeave,
  assertCanRemove,
  assertCanTransferCaptaincy,
  DEFAULT_TEAM_LIMITS,
  isPlayingRole,
  teamCan,
  type ActiveMember,
} from './teams.js';

const roster: ActiveMember[] = [
  { userId: 'cap', role: 'captain' },
  { userId: 'co', role: 'co_captain' },
  { userId: 'p1', role: 'player' },
  { userId: 'sub', role: 'substitute' },
  { userId: 'coach', role: 'coach' },
];

function reasonOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (error) {
    if (error instanceof TeamRuleError) return error.details['reason'] as string;
    throw error;
  }
  return undefined;
}

describe('team permissions', () => {
  it('gives the captain every permission', () => {
    for (const permission of [
      'team:edit',
      'team:invite',
      'team:manage_roster',
      'team:transfer_captaincy',
      'team:dissolve',
    ] as const) {
      expect(teamCan('captain', permission)).toBe(true);
    }
  });

  it('lets the co-captain manage the roster but not dissolve or transfer', () => {
    expect(teamCan('co_captain', 'team:invite')).toBe(true);
    expect(teamCan('co_captain', 'team:manage_roster')).toBe(true);
    expect(teamCan('co_captain', 'team:dissolve')).toBe(false);
    expect(teamCan('co_captain', 'team:transfer_captaincy')).toBe(false);
  });

  it('gives players, substitutes, coaches and managers no management rights', () => {
    for (const role of ['player', 'substitute', 'coach', 'manager'] as const) {
      expect(teamCan(role, 'team:invite')).toBe(false);
      expect(teamCan(role, 'team:view_private')).toBe(true);
    }
  });

  it('knows which roles play', () => {
    expect(
      ['captain', 'co_captain', 'player', 'substitute'].every((r) => isPlayingRole(r as never)),
    ).toBe(true);
    expect(isPlayingRole('coach')).toBe(false);
    expect(isPlayingRole('manager')).toBe(false);
  });
});

describe('joining a team', () => {
  it('accepts a new player with a verified Riot account', () => {
    expect(
      reasonOf(() => {
        assertCanJoin(roster, { userId: 'new', role: 'player', hasVerifiedRiotAccount: true });
      }),
    ).toBeUndefined();
  });

  it('never lists a user twice in the active roster', () => {
    expect(
      reasonOf(() => {
        assertCanJoin(roster, { userId: 'p1', role: 'substitute', hasVerifiedRiotAccount: true });
      }),
    ).toBe('already_member');
  });

  it('requires a verified Riot account to play, not to coach', () => {
    expect(
      reasonOf(() => {
        assertCanJoin(roster, { userId: 'new', role: 'player', hasVerifiedRiotAccount: false });
      }),
    ).toBe('riot_account_required');
    expect(
      reasonOf(() => {
        assertCanJoin(roster, { userId: 'new', role: 'coach', hasVerifiedRiotAccount: false });
      }),
    ).toBeUndefined();
  });

  it('does not let anyone join as captain', () => {
    expect(
      reasonOf(() => {
        assertCanJoin(roster, { userId: 'new', role: 'captain', hasVerifiedRiotAccount: true });
      }),
    ).toBe('captain_not_assignable');
  });
});

describe('creating a team', () => {
  it('applies the default limits: two teams created, one captaincy at a time', () => {
    expect(DEFAULT_TEAM_LIMITS).toEqual({ maxTeamsCreated: 2, maxCaptaincies: 1 });
    const ok = { teamsCreated: 1, activeCaptaincies: 0, hasVerifiedRiotAccount: true };
    expect(
      reasonOf(() => {
        assertCanCreateTeam(ok);
      }),
    ).toBeUndefined();
    expect(
      reasonOf(() => {
        assertCanCreateTeam({ ...ok, teamsCreated: 2 });
      }),
    ).toBe('team_creation_limit');
    expect(
      reasonOf(() => {
        assertCanCreateTeam({ ...ok, activeCaptaincies: 1 });
      }),
    ).toBe('captaincy_limit');
    expect(
      reasonOf(() => {
        assertCanCreateTeam({ ...ok, hasVerifiedRiotAccount: false });
      }),
    ).toBe('riot_account_required');
  });

  it('reads the limits from configuration', () => {
    const state = { teamsCreated: 2, activeCaptaincies: 1, hasVerifiedRiotAccount: true };
    expect(
      reasonOf(() => {
        assertCanCreateTeam(state, { maxTeamsCreated: 3, maxCaptaincies: 2 });
      }),
    ).toBeUndefined();
  });
});

describe('removing and leaving', () => {
  it('lets the captain or co-captain remove a member', () => {
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'cap', 'p1');
      }),
    ).toBeUndefined();
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'co', 'sub');
      }),
    ).toBeUndefined();
  });

  it('protects the captain and rejects outsiders and non-managers', () => {
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'co', 'cap');
      }),
    ).toBe('captain_protected');
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'p1', 'sub');
      }),
    ).toBe('forbidden');
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'stranger', 'p1');
      }),
    ).toBe('not_a_member');
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'cap', 'stranger');
      }),
    ).toBe('target_not_a_member');
    expect(
      reasonOf(() => {
        assertCanRemove(roster, 'cap', 'cap');
      }),
    ).toBe('use_leave');
  });

  it('makes the captain transfer before leaving, or dissolve when alone', () => {
    expect(
      reasonOf(() => {
        assertCanLeave(roster, 'p1');
      }),
    ).toBeUndefined();
    expect(
      reasonOf(() => {
        assertCanLeave(roster, 'cap');
      }),
    ).toBe('captain_must_transfer');
    expect(
      reasonOf(() => {
        assertCanLeave([{ userId: 'cap', role: 'captain' }], 'cap');
      }),
    ).toBe('captain_must_dissolve');
    expect(
      reasonOf(() => {
        assertCanLeave(roster, 'stranger');
      }),
    ).toBe('not_a_member');
  });
});

describe('changing roles', () => {
  it('lets managers change a member role, except to or from captain', () => {
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'cap', 'p1', 'co_captain');
      }),
    ).toBeUndefined();
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'co', 'sub', 'player');
      }),
    ).toBeUndefined();
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'cap', 'p1', 'captain');
      }),
    ).toBe('captain_not_assignable');
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'co', 'cap', 'player');
      }),
    ).toBe('captain_protected');
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'p1', 'sub', 'player');
      }),
    ).toBe('forbidden');
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'cap', 'ghost', 'player');
      }),
    ).toBe('target_not_a_member');
  });

  it('keeps the Riot requirement when moving a coach into a playing role', () => {
    expect(
      reasonOf(() => {
        assertCanChangeRole(roster, 'cap', 'coach', 'player', {
          targetHasVerifiedRiotAccount: false,
        });
      }),
    ).toBe('riot_account_required');
  });
});

describe('transferring the captaincy', () => {
  it('only the captain transfers, to another active member', () => {
    expect(
      reasonOf(() => {
        assertCanTransferCaptaincy(roster, 'cap', 'p1');
      }),
    ).toBeUndefined();
    expect(
      reasonOf(() => {
        assertCanTransferCaptaincy(roster, 'co', 'p1');
      }),
    ).toBe('forbidden');
    expect(
      reasonOf(() => {
        assertCanTransferCaptaincy(roster, 'cap', 'cap');
      }),
    ).toBe('already_captain');
    expect(
      reasonOf(() => {
        assertCanTransferCaptaincy(roster, 'cap', 'ghost');
      }),
    ).toBe('target_not_a_member');
  });

  it('respects the captaincy limit of the new captain', () => {
    expect(
      reasonOf(() => {
        assertCanTransferCaptaincy(roster, 'cap', 'p1', { targetActiveCaptaincies: 1 });
      }),
    ).toBe('captaincy_limit');
  });
});
