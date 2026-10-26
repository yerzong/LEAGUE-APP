import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared/clock.js';
import { FakeImageStorage, PNG_BYTES } from '../../identity/testing/fake-image-storage.js';
import {
  InMemoryFreeAgentRepository,
  InMemoryTeamRepository,
} from '../testing/in-memory-team-repository.js';
import type { TeamsDeps } from './deps.js';
import {
  AcceptInvitationUseCase,
  CancelCaptaincyTransferUseCase,
  ChangeMemberUseCase,
  CreateTeamUseCase,
  DeclineInvitationUseCase,
  DecideJoinRequestUseCase,
  DissolveTeamUseCase,
  GetFreeAgentUseCase,
  GetInvitationByCodeUseCase,
  GetTeamUseCase,
  InviteToTeamUseCase,
  LeaveTeamUseCase,
  ListMyInvitationsUseCase,
  ListMyTeamsUseCase,
  RemoveMemberUseCase,
  RequestCaptaincyTransferUseCase,
  RequestToJoinUseCase,
  RespondCaptaincyTransferUseCase,
  RevokeInvitationUseCase,
  UpdateFreeAgentUseCase,
  UpdateTeamUseCase,
  UploadTeamLogoUseCase,
} from './teams.use-cases.js';

const ORG = 'org-1';
const users = ['ana', 'beto', 'carla', 'dani', 'eli'] as const;
type User = (typeof users)[number];

function setup({ unverified = [] as User[] } = {}) {
  let now = new Date('2026-10-24T12:00:00.000Z');
  const clock: Clock = { now: () => now };
  const teams = new InMemoryTeamRepository(() => now);
  const freeAgents = new InMemoryFreeAgentRepository();
  let code = 0;
  let id = 0;
  const deps: TeamsDeps = {
    teams,
    freeAgents,
    users: {
      summaries: (ids) =>
        Promise.resolve(
          new Map(
            ids.map((u) => [u, { username: u, displayName: u.toUpperCase(), avatarUrl: null }]),
          ),
        ),
      findById: (u) => Promise.resolve((users as readonly string[]).includes(u) ? { id: u } : null),
    },
    riot: {
      hasVerifiedAccount: (u) => Promise.resolve(!unverified.includes(u as User)),
      riotIdsOf: (ids) => Promise.resolve(new Map(ids.map((u) => [u, `${u}#LAN`]))),
    },
    organization: { id: () => Promise.resolve(ORG) },
    storage: new FakeImageStorage(),
    clock,
    newCode: () => `invite-code-${String((code += 1)).padStart(8, '0')}`,
    newId: () => `logo-${String((id += 1))}`,
  };
  const create = new CreateTeamUseCase(deps);
  return {
    deps,
    teams,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    create,
    update: new UpdateTeamUseCase(deps),
    logo: new UploadTeamLogoUseCase(deps),
    mine: new ListMyTeamsUseCase(deps),
    get: new GetTeamUseCase(deps),
    dissolve: new DissolveTeamUseCase(deps),
    invite: new InviteToTeamUseCase(deps),
    revoke: new RevokeInvitationUseCase(deps),
    myInvitations: new ListMyInvitationsUseCase(deps),
    byCode: new GetInvitationByCodeUseCase(deps),
    accept: new AcceptInvitationUseCase(deps),
    decline: new DeclineInvitationUseCase(deps),
    requestJoin: new RequestToJoinUseCase(deps),
    decide: new DecideJoinRequestUseCase(deps),
    change: new ChangeMemberUseCase(deps),
    remove: new RemoveMemberUseCase(deps),
    leave: new LeaveTeamUseCase(deps),
    transfer: new RequestCaptaincyTransferUseCase(deps),
    respondTransfer: new RespondCaptaincyTransferUseCase(deps),
    cancelTransfer: new CancelCaptaincyTransferUseCase(deps),
    getFreeAgent: new GetFreeAgentUseCase(deps),
    updateFreeAgent: new UpdateFreeAgentUseCase(deps),
    aurora: () =>
      create.execute('ana', {
        name: 'Águilas Aurora',
        tag: 'AUR',
        region: 'la1',
        description: null,
      }),
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; details?: { reason?: string } };
    return e.details?.reason ?? e.code;
  }
  return undefined;
}

/** Ana's team with Beto invited and accepted. */
async function teamWithBeto(s: ReturnType<typeof setup>) {
  const team = await s.aurora();
  const invitation = await s.invite.execute('ana', team.id, {
    kind: 'user',
    userId: 'beto',
    teamRole: 'player',
  });
  await s.accept.execute('beto', { invitationId: invitation.id });
  return team;
}

describe('creating teams', () => {
  it('creates the team with a slug and its creator as captain', async () => {
    const s = setup();
    const team = await s.aurora();
    expect(team).toMatchObject({
      slug: 'aguilas-aurora',
      name: 'Águilas Aurora',
      tag: 'AUR',
      myRole: 'captain',
      members: [{ userId: 'ana', teamRole: 'captain', riotId: 'ana#LAN', username: 'ana' }],
      nameHistory: [{ name: 'Águilas Aurora', tag: 'AUR' }],
    });
    expect(team.permissions).toContain('team:dissolve');
  });

  it('rejects a duplicated name or tag in the organization', async () => {
    const s = setup();
    await s.aurora();
    expect(
      await codeOf(
        s.create.execute('carla', {
          name: 'águilas aurora',
          tag: 'XYZ',
          region: 'la1',
          description: null,
        }),
      ),
    ).toBe('team_name_taken');
    expect(
      await codeOf(
        s.create.execute('carla', { name: 'Boreal', tag: 'AUR', region: 'la1', description: null }),
      ),
    ).toBe('team_tag_taken');
  });

  it('adds a suffix when the slug is taken by another name', async () => {
    const s = setup();
    await s.aurora();
    const other = await s.create.execute('carla', {
      name: 'Aguilas-Aurora!',
      tag: 'AU2',
      region: 'la1',
      description: null,
    });
    expect(other.slug).toBe('aguilas-aurora-2');
  });

  it('requires a verified Riot account and respects the captaincy limit', async () => {
    const s = setup({ unverified: ['carla'] });
    expect(
      await codeOf(
        s.create.execute('carla', { name: 'Cenit', tag: 'CEN', region: 'la1', description: null }),
      ),
    ).toBe('riot_account_required');
    await s.aurora();
    expect(
      await codeOf(
        s.create.execute('ana', { name: 'Otra', tag: 'OTR', region: 'la1', description: null }),
      ),
    ).toBe('captaincy_limit');
  });

  it('lets the captain edit the team and upload a logo; members cannot', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    const renamed = await s.update.execute('ana', team.id, {
      name: 'Aurora',
      tag: 'AUR',
      region: 'la2',
      description: 'Hola',
    });
    expect(renamed).toMatchObject({ name: 'Aurora', region: 'la2', slug: 'aguilas-aurora' });
    expect(renamed.nameHistory.map((h) => h.name)).toEqual(['Aurora', 'Águilas Aurora']);
    expect(
      await codeOf(
        s.update.execute('beto', team.id, {
          name: 'X',
          tag: 'XX',
          region: 'la1',
          description: null,
        }),
      ),
    ).toBe('forbidden');
    const withLogo = await s.logo.execute('ana', team.id, {
      buffer: PNG_BYTES,
      size: PNG_BYTES.length,
    });
    expect(withLogo.logoUrl).toBe(`https://storage.test/team-logos/${team.id}/logo-1.png`);
  });
});

describe('viewing teams', () => {
  it('lists my teams with my role', async () => {
    const s = setup();
    await teamWithBeto(s);
    await expect(s.mine.execute('beto')).resolves.toMatchObject([
      { slug: 'aguilas-aurora', myRole: 'player' },
    ]);
  });

  it('shows invitations and requests to managers only, and nothing to outsiders', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    await s.invite.execute('ana', team.id, { kind: 'link', teamRole: 'substitute' });
    expect((await s.get.execute('ana', team.slug)).invitations).toHaveLength(1);
    const asPlayer = await s.get.execute('beto', team.slug);
    expect(asPlayer).toMatchObject({ myRole: 'player', invitations: [], joinRequests: [] });
    expect(asPlayer.members).toHaveLength(2);
    expect(await codeOf(s.get.execute('carla', team.slug))).toBe('not_a_member');
    expect(await codeOf(s.get.execute('ana', 'nope'))).toBe('team_not_found');
  });
});

describe('invitations', () => {
  it('invites a user who accepts and joins the roster', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    expect((await s.get.execute('ana', team.slug)).members.map((m) => m.userId)).toEqual([
      'ana',
      'beto',
    ]);
  });

  it('lists my pending invitations and lets me decline', async () => {
    const s = setup();
    const team = await s.aurora();
    const invitation = await s.invite.execute('ana', team.id, {
      kind: 'user',
      userId: 'carla',
      teamRole: 'coach',
    });
    await expect(s.myInvitations.execute('carla')).resolves.toMatchObject([
      { id: invitation.id, team: { tag: 'AUR' }, teamRole: 'coach' },
    ]);
    await s.decline.execute('carla', invitation.id);
    await expect(s.myInvitations.execute('carla')).resolves.toEqual([]);
    expect(await codeOf(s.accept.execute('carla', { invitationId: invitation.id }))).toBe(
      'invitation_not_pending',
    );
  });

  it('joins by link code once', async () => {
    const s = setup();
    const team = await s.aurora();
    const link = await s.invite.execute('ana', team.id, { kind: 'link', teamRole: 'player' });
    const code = link.inviteCode ?? '';
    await expect(s.byCode.execute(code)).resolves.toMatchObject({
      team: { name: 'Águilas Aurora' },
      teamRole: 'player',
    });
    await s.accept.execute('dani', { code });
    expect(await codeOf(s.accept.execute('eli', { code }))).toBe('invitation_not_pending');
    expect(await codeOf(s.byCode.execute('unknown-code'))).toBe('invitation_not_found');
  });

  it('never adds a player twice to the active roster', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    expect(
      await codeOf(
        s.invite.execute('ana', team.id, { kind: 'user', userId: 'beto', teamRole: 'substitute' }),
      ),
    ).toBe('already_member');
    const link = await s.invite.execute('ana', team.id, { kind: 'link', teamRole: 'player' });
    expect(await codeOf(s.accept.execute('beto', { code: link.inviteCode ?? '' }))).toBe(
      'already_member',
    );
  });

  it('does not invite the same user twice while pending, nor unknown users', async () => {
    const s = setup();
    const team = await s.aurora();
    await s.invite.execute('ana', team.id, { kind: 'user', userId: 'carla', teamRole: 'player' });
    expect(
      await codeOf(
        s.invite.execute('ana', team.id, { kind: 'user', userId: 'carla', teamRole: 'player' }),
      ),
    ).toBe('invitation_already_pending');
    expect(
      await codeOf(
        s.invite.execute('ana', team.id, { kind: 'user', userId: 'ghost', teamRole: 'player' }),
      ),
    ).toBe('user_not_found');
  });

  it('requires a verified Riot account to accept a playing role, not a coaching one', async () => {
    const s = setup({ unverified: ['carla'] });
    const team = await s.aurora();
    const asPlayer = await s.invite.execute('ana', team.id, {
      kind: 'user',
      userId: 'carla',
      teamRole: 'player',
    });
    expect(await codeOf(s.accept.execute('carla', { invitationId: asPlayer.id }))).toBe(
      'riot_account_required',
    );
    const link = await s.invite.execute('ana', team.id, { kind: 'link', teamRole: 'coach' });
    await s.accept.execute('carla', { code: link.inviteCode ?? '' });
  });

  it('expires invitations after a week and lets managers revoke them', async () => {
    const s = setup();
    const team = await s.aurora();
    const invitation = await s.invite.execute('ana', team.id, {
      kind: 'user',
      userId: 'carla',
      teamRole: 'player',
    });
    s.advance(7 * 24 * 60 * 60 * 1000 + 1);
    expect(await codeOf(s.accept.execute('carla', { invitationId: invitation.id }))).toBe(
      'invitation_expired',
    );

    const other = await s.invite.execute('ana', team.id, {
      kind: 'user',
      userId: 'dani',
      teamRole: 'player',
    });
    await s.revoke.execute('ana', team.id, other.id);
    expect(await codeOf(s.accept.execute('dani', { invitationId: other.id }))).toBe(
      'invitation_not_pending',
    );
  });

  it('only the invited user accepts a personal invitation; players cannot invite', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    const invitation = await s.invite.execute('ana', team.id, {
      kind: 'user',
      userId: 'carla',
      teamRole: 'player',
    });
    expect(await codeOf(s.accept.execute('dani', { invitationId: invitation.id }))).toBe(
      'invitation_not_found',
    );
    expect(
      await codeOf(s.invite.execute('beto', team.id, { kind: 'link', teamRole: 'player' })),
    ).toBe('forbidden');
  });
});

describe('join requests', () => {
  it('lets a player request to join and the captain approve with a role', async () => {
    const s = setup();
    const team = await s.aurora();
    const request = await s.requestJoin.execute('carla', team.id, { message: 'Juego jungla' });
    expect(await codeOf(s.requestJoin.execute('carla', team.id, { message: null }))).toBe(
      'join_request_already_pending',
    );
    expect((await s.get.execute('ana', team.slug)).joinRequests).toMatchObject([
      { id: request.id, message: 'Juego jungla' },
    ]);

    await s.decide.execute('ana', team.id, request.id, {
      decision: 'approve',
      teamRole: 'substitute',
    });
    expect(
      (await s.get.execute('ana', team.slug)).members.find((m) => m.userId === 'carla')?.teamRole,
    ).toBe('substitute');
  });

  it('declines requests and rejects members or unverified requesters', async () => {
    const s = setup({ unverified: ['dani'] });
    const team = await teamWithBeto(s);
    const request = await s.requestJoin.execute('carla', team.id, { message: null });
    await s.decide.execute('ana', team.id, request.id, { decision: 'decline', teamRole: 'player' });
    expect((await s.get.execute('ana', team.slug)).joinRequests).toEqual([]);
    expect(await codeOf(s.requestJoin.execute('beto', team.id, { message: null }))).toBe(
      'already_member',
    );
    expect(await codeOf(s.requestJoin.execute('dani', team.id, { message: null }))).toBe(
      'riot_account_required',
    );
    expect(
      await codeOf(
        s.decide.execute('beto', team.id, request.id, { decision: 'approve', teamRole: 'player' }),
      ),
    ).toBe('forbidden');
  });
});

describe('roster management', () => {
  it('changes internal and game roles', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    const updated = await s.change.execute('ana', team.id, 'beto', {
      teamRole: 'co_captain',
      gameRole: 'jungle',
    });
    expect(updated.members.find((m) => m.userId === 'beto')).toMatchObject({
      teamRole: 'co_captain',
      gameRole: 'jungle',
    });
    const own = await s.change.execute('ana', team.id, 'ana', { gameRole: 'mid' });
    expect(own.members.find((m) => m.userId === 'ana')?.gameRole).toBe('mid');
    expect(await codeOf(s.change.execute('beto', team.id, 'ana', { teamRole: 'player' }))).toBe(
      'captain_protected',
    );
  });

  it('removes members, lets them leave, and keeps the captain until a transfer', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    const link = await s.invite.execute('ana', team.id, { kind: 'link', teamRole: 'player' });
    await s.accept.execute('carla', { code: link.inviteCode ?? '' });

    await s.remove.execute('ana', team.id, 'carla');
    await s.leave.execute('beto', team.id);
    expect((await s.get.execute('ana', team.slug)).members.map((m) => m.userId)).toEqual(['ana']);
    expect(await codeOf(s.leave.execute('ana', team.id))).toBe('captain_must_dissolve');
  });
});

describe('captaincy transfer', () => {
  it('needs the new captain to accept, then swaps the roles and audits it', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    await s.transfer.execute('ana', team.id, { toUserId: 'beto' });
    expect((await s.get.execute('beto', team.slug)).pendingTransfer).toMatchObject({
      fromUserId: 'ana',
      toUserId: 'beto',
    });
    expect(await codeOf(s.respondTransfer.execute('ana', team.id, 'accept'))).toBe(
      'transfer_not_found',
    );

    await s.respondTransfer.execute('beto', team.id, 'accept');
    const after = await s.get.execute('beto', team.slug);
    expect(after.myRole).toBe('captain');
    expect(after.members.find((m) => m.userId === 'ana')?.teamRole).toBe('co_captain');
    expect(s.teams.audit).toMatchObject([
      { action: 'team.captaincy.transferred', actorId: 'beto' },
    ]);
  });

  it('can be declined or canceled, and only one is pending at a time', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    await s.transfer.execute('ana', team.id, { toUserId: 'beto' });
    expect(await codeOf(s.transfer.execute('ana', team.id, { toUserId: 'beto' }))).toBe(
      'transfer_already_pending',
    );
    await s.respondTransfer.execute('beto', team.id, 'decline');
    await s.transfer.execute('ana', team.id, { toUserId: 'beto' });
    await s.cancelTransfer.execute('ana', team.id);
    expect((await s.get.execute('ana', team.slug)).pendingTransfer).toBeNull();
  });

  it('respects the captaincy limit of the new captain', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    await s.create.execute('carla', {
      name: 'Cenit',
      tag: 'CEN',
      region: 'la1',
      description: null,
    });
    const link = await s.invite.execute('ana', team.id, { kind: 'link', teamRole: 'player' });
    await s.accept.execute('carla', { code: link.inviteCode ?? '' });
    expect(await codeOf(s.transfer.execute('ana', team.id, { toUserId: 'carla' }))).toBe(
      'captaincy_limit',
    );
  });
});

describe('dissolving', () => {
  it('only the captain dissolves, with a reason, and it is audited', async () => {
    const s = setup();
    const team = await teamWithBeto(s);
    expect(await codeOf(s.dissolve.execute('beto', team.id, 'Ya no jugamos juntos'))).toBe(
      'forbidden',
    );
    await s.dissolve.execute('ana', team.id, 'Ya no jugamos juntos');
    expect(s.teams.audit).toMatchObject([
      { action: 'team.dissolved', actorId: 'ana', reason: 'Ya no jugamos juntos' },
    ]);
    await expect(s.mine.execute('ana')).resolves.toEqual([]);
    expect(await codeOf(s.requestJoin.execute('carla', team.id, { message: null }))).toBe(
      'team_not_active',
    );
  });
});

describe('free agents', () => {
  it('marks me as available with roles and schedule, for 30 days', async () => {
    const s = setup();
    await expect(s.getFreeAgent.execute('carla')).resolves.toMatchObject({
      active: false,
      roles: [],
    });
    const saved = await s.updateFreeAgent.execute('carla', {
      active: true,
      roles: ['jungle', 'top'],
      message: 'Busco equipo competitivo',
      availability: { version: 1, days: [1, 3, 5], from: '19:00', to: '23:00' },
    });
    expect(saved).toMatchObject({
      active: true,
      roles: ['jungle', 'top'],
      activeUntil: '2026-11-23T12:00:00.000Z',
    });

    const paused = await s.updateFreeAgent.execute('carla', {
      ...saved,
      message: null,
      active: false,
    });
    expect(paused).toMatchObject({ active: false, roles: ['jungle', 'top'] });
  });
});
