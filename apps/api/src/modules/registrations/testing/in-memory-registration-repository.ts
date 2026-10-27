// Test double for RegistrationRepository with the guarantees of the database
// and of svc_register_entrant / svc_decide_entrant: one registration per team,
// the anti-chapulineo index, capacity with waitlist, roster release and
// waitlist promotion.
import type { EntrantStatus } from '@league/contracts';
import type { RosterMembership } from '@league/core';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import type { InMemoryTournamentRepository } from '../../tournaments/testing/in-memory-tournament-repository.js';
import type { NewEntrant, RegistrationRepository } from '../application/ports.js';
import { ACTIVE_STATUSES, type EntrantRecord, type RosterRecord } from '../domain/registration.js';

type Stored = { -readonly [K in keyof EntrantRecord]: EntrantRecord[K] } & { eligibility: unknown };

export class InMemoryRegistrationRepository implements RegistrationRepository {
  readonly entrants: Stored[] = [];
  readonly audit: { action: string; reason: string | null }[] = [];
  readonly events: string[] = [];
  private sequence = 0;

  constructor(
    private readonly now: () => Date,
    private readonly tournaments: InMemoryTournamentRepository,
  ) {}

  private tournament(tournamentId: string) {
    const t = this.tournaments.tournaments.find((x) => x.id === tournamentId);
    if (!t) throw new ApplicationError('conflict', 'tournament_not_found');
    return t;
  }

  private active(tournamentId: string, statuses: readonly EntrantStatus[]) {
    return this.entrants.filter(
      (e) => e.tournamentId === tournamentId && statuses.includes(e.status),
    );
  }

  register(input: {
    tournamentId: string;
    actorId: string;
    entrant: NewEntrant;
    roster: readonly RosterRecord[];
  }): Promise<string> {
    const t = this.tournament(input.tournamentId);
    if (t.status !== 'registration_open') throw conflict('registration_closed');
    const sameTeam = this.active(input.tournamentId, ACTIVE_STATUSES).some((e) =>
      input.entrant.teamId
        ? e.teamId === input.entrant.teamId
        : e.teamId === null && e.userId === input.entrant.userId,
    );
    if (sameTeam) throw conflict('already_registered');
    const held = this.entrants
      .filter((e) => ACTIVE_STATUSES.includes(e.status))
      .flatMap((e) => e.roster)
      .filter((r) => r.exclusivityKey !== null);
    if (
      input.roster.some((r) =>
        held.some((h) => h.userId === r.userId && h.exclusivityKey === r.exclusivityKey),
      )
    )
      throw conflict('exclusivity_conflict');

    const taken = this.active(input.tournamentId, ['pending', 'approved']).length;
    const capacity = t.config.capacity.capacity;
    let status: EntrantStatus = 'pending';
    let waitlistPosition: number | null = null;
    if (capacity !== null && taken >= capacity) {
      if (!t.config.capacity.waitlistEnabled) throw conflict('tournament_full');
      status = 'waitlisted';
      waitlistPosition = this.active(input.tournamentId, ['waitlisted']).length + 1;
    }
    this.sequence += 1;
    const id = `00000000-0000-4000-d000-${String(this.sequence).padStart(12, '0')}`;
    this.entrants.push({
      id,
      tournamentId: input.tournamentId,
      teamId: input.entrant.teamId,
      userId: input.entrant.userId,
      displayName: input.entrant.displayName,
      displayTag: input.entrant.displayTag,
      logoPath: input.entrant.logoPath,
      status,
      seed: null,
      waitlistPosition,
      rejectionReason: null,
      rulebookVersionId: input.entrant.rulebookVersionId,
      registeredBy: input.actorId,
      createdAt: this.now(),
      roster: [...input.roster],
      eligibility: input.entrant.eligibility,
    });
    this.events.push(
      status === 'waitlisted' ? 'registration.waitlisted' : 'registration.submitted',
    );
    return Promise.resolve(id);
  }

  find(entrantId: string): Promise<EntrantRecord | null> {
    const e = this.entrants.find((x) => x.id === entrantId);
    return Promise.resolve(e ? { ...e } : null);
  }

  listByTournament(tournamentId: string): Promise<EntrantRecord[]> {
    return Promise.resolve(
      this.entrants.filter((e) => e.tournamentId === tournamentId).map((e) => ({ ...e })),
    );
  }

  involving(teamIds: readonly string[], userId: string): Promise<EntrantRecord[]> {
    return Promise.resolve(
      this.entrants
        .filter(
          (e) =>
            (e.teamId !== null && teamIds.includes(e.teamId)) ||
            e.userId === userId ||
            e.registeredBy === userId,
        )
        .map((e) => ({ ...e })),
    );
  }

  decide(
    entrantId: string,
    _actorId: string,
    change: {
      from: EntrantStatus;
      to: EntrantStatus;
      auditAction: string | null;
      event: string;
      reason: string | null;
    },
  ): Promise<void> {
    const entrant = this.entrants.find((e) => e.id === entrantId);
    if (!entrant) throw conflict('registration_not_found');
    if (entrant.status !== change.from) throw conflict('registration_status_changed');
    const t = this.tournament(entrant.tournamentId);
    const capacity = t.config.capacity.capacity;
    if (
      change.to === 'approved' &&
      capacity !== null &&
      this.active(entrant.tournamentId, ['approved']).length >= capacity
    )
      throw conflict('tournament_full');

    entrant.status = change.to;
    entrant.waitlistPosition = null;
    if (change.to === 'rejected' || change.to === 'disqualified')
      entrant.rejectionReason = change.reason;
    const leaving = ['rejected', 'withdrawn', 'disqualified'].includes(change.to);
    if (leaving) entrant.roster = [];
    if (change.auditAction) this.audit.push({ action: change.auditAction, reason: change.reason });
    this.events.push(change.event);

    if (leaving && ['pending', 'approved'].includes(change.from)) {
      const next = this.active(entrant.tournamentId, ['waitlisted']).sort(
        (a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0),
      )[0];
      if (next) {
        next.status = 'pending';
        next.waitlistPosition = null;
        this.events.push('registration.promoted');
      }
    }
    return Promise.resolve();
  }

  setSeeds(
    tournamentId: string,
    _actorId: string,
    _method: string,
    seeds: readonly { entrantId: string; seed: number }[],
  ): Promise<void> {
    for (const e of this.entrants.filter((x) => x.tournamentId === tournamentId)) {
      e.seed = seeds.find((s) => s.entrantId === e.id)?.seed ?? null;
    }
    this.audit.push({ action: 'tournament.seeded', reason: null });
    this.events.push('tournament.seeded');
    return Promise.resolve();
  }

  counts(
    tournamentIds: readonly string[],
  ): Promise<Map<string, { pending: number; approved: number; waitlisted: number }>> {
    return Promise.resolve(
      new Map(
        tournamentIds.map((id) => [
          id,
          {
            pending: this.active(id, ['pending']).length,
            approved: this.active(id, ['approved']).length,
            waitlisted: this.active(id, ['waitlisted']).length,
          },
        ]),
      ),
    );
  }

  activeRostersOf(userIds: readonly string[]): Promise<Map<string, RosterMembership[]>> {
    const map = new Map<string, RosterMembership[]>(userIds.map((u) => [u, []]));
    for (const e of this.entrants.filter((x) => ACTIVE_STATUSES.includes(x.status))) {
      const t = this.tournament(e.tournamentId);
      for (const r of e.roster) {
        map.get(r.userId)?.push({
          entrantId: e.id,
          teamId: e.teamId,
          tournamentId: e.tournamentId,
          seasonId: t.config.basics.seasonId,
          circuitId: t.config.eligibility.circuitId,
          tier: t.config.basics.tier,
          joinedAt: e.createdAt.toISOString(),
          leftAt: null,
        });
      }
    }
    return Promise.resolve(map);
  }
}
