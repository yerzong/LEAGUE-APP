import type { EntrantStatus, TeamRole } from '@league/contracts';
import type { RosterMembership } from '@league/core';

import type { EntrantRecord, RosterRecord } from '../domain/registration.js';

export interface NewEntrant {
  readonly teamId: string | null;
  readonly userId: string | null;
  readonly displayName: string;
  readonly displayTag: string | null;
  readonly logoPath: string | null;
  readonly rulebookVersionId: string | null;
  /** The EligibilityResult of packages/core at registration. */
  readonly eligibility: unknown;
}

export interface RegistrationRepository {
  /**
   * Inserts the entrant and its roster; capacity decides pending or waitlisted.
   * Throws `already_registered`, `exclusivity_conflict`, `registration_closed`
   * or `tournament_full`.
   */
  register(input: {
    tournamentId: string;
    actorId: string;
    entrant: NewEntrant;
    roster: readonly RosterRecord[];
  }): Promise<string>;
  find(entrantId: string): Promise<EntrantRecord | null>;
  listByTournament(tournamentId: string): Promise<EntrantRecord[]>;
  /** Registrations of these teams, or of the user (solo or submitted by them). */
  involving(teamIds: readonly string[], userId: string): Promise<EntrantRecord[]>;
  /** Throws `registration_status_changed` or `tournament_full`. */
  decide(
    entrantId: string,
    actorId: string,
    change: {
      from: EntrantStatus;
      to: EntrantStatus;
      auditAction: string | null;
      event: string;
      reason: string | null;
    },
  ): Promise<void>;
  setSeeds(
    tournamentId: string,
    actorId: string,
    method: string,
    seeds: readonly { entrantId: string; seed: number }[],
  ): Promise<void>;
  counts(
    tournamentIds: readonly string[],
  ): Promise<Map<string, { pending: number; approved: number; waitlisted: number }>>;
  /** Active roster memberships of the users, in the shape packages/core reads. */
  activeRostersOf(userIds: readonly string[]): Promise<Map<string, RosterMembership[]>>;
}

/** What eligibility needs to know about a player (identity + riot-accounts). */
export interface PlayerFacts {
  readonly userId: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly riot: {
    readonly accountId: string;
    readonly riotId: string;
    readonly region: string;
    readonly summonerLevel: number | null;
    readonly rank: { readonly tier: string; readonly division?: number } | null;
    readonly rankHistory: readonly {
      readonly rank: { readonly tier: string; readonly division?: number };
      readonly takenAt: string;
    }[];
    readonly rankedGames: number | null;
  } | null;
  readonly birthDate: string | null;
  readonly countryCode: string | null;
  readonly gender: { readonly value: string; readonly declaredAt: string } | null;
  readonly legalNameProvided: boolean;
  readonly institution: {
    readonly id: string;
    readonly email: string;
    readonly verified: boolean;
  } | null;
}

export interface PlayerFactsReader {
  factsOf(userIds: readonly string[]): Promise<Map<string, PlayerFacts>>;
}

export interface TeamView {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly tag: string;
  readonly logoPath: string | null;
  readonly status: string;
}

/** From teams (TeamQueries). */
export interface TeamDirectory {
  findById(teamId: string): Promise<TeamView | null>;
  activeMembers(
    teamId: string,
  ): Promise<{ userId: string; teamRole: TeamRole; gameRole: string | null }[]>;
  activeTeamsOf(userId: string): Promise<{ team: TeamView; role: TeamRole }[]>;
  logoUrl(path: string | null): string | null;
}
