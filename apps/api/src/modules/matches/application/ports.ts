import type { StandingStatus } from '@league/contracts';

import type {
  CompetitionChange,
  DisputeRecord,
  GameRecord,
  MatchRecord,
  ReportRecord,
  RescheduleRecord,
} from '../domain/match.js';

export interface StandingRecord {
  readonly phaseId: string;
  readonly groupId: string | null;
  readonly entrantId: string;
  readonly rank: number;
  readonly points: number;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly gameWins: number;
  readonly gameLosses: number;
  readonly gameDiff: number;
  readonly status: StandingStatus;
  readonly tiebreakDetails: {
    readonly steps?: readonly { criterion: string; value: number; among: readonly string[] }[];
    readonly tiedWith?: readonly string[];
  };
}

export interface MatchRepository {
  matchesOf(tournamentId: string): Promise<MatchRecord[]>;
  find(matchId: string): Promise<MatchRecord | null>;
  /** Matches where any of the registrations plays. */
  matchesOfEntrants(entrantIds: readonly string[]): Promise<MatchRecord[]>;
  games(matchIds: readonly string[]): Promise<GameRecord[]>;
  checkins(matchIds: readonly string[]): Promise<{ matchId: string; entrantId: string }[]>;
  reports(matchId: string): Promise<ReportRecord[]>;
  disputes(matchIds: readonly string[]): Promise<DisputeRecord[]>;
  findDispute(disputeId: string): Promise<DisputeRecord | null>;
  reschedules(matchIds: readonly string[]): Promise<RescheduleRecord[]>;
  findReschedule(requestId: string): Promise<RescheduleRecord | null>;
  standings(tournamentId: string): Promise<StandingRecord[]>;
  /** Check-in windows to open (pending/scheduled) and to close (checkin), as of `now`. */
  dueCheckins(now: Date): Promise<{ toOpen: MatchRecord[]; toClose: MatchRecord[] }>;
  /**
   * Applies the unit of work in one transaction. Throws `match_version_conflict`,
   * `tournament_status_changed`, `dispute_not_open` or `reschedule_not_open`.
   */
  commit(tournamentId: string, actorId: string | null, change: CompetitionChange): Promise<void>;
}

/** Screenshots of results and disputes: private bucket, signed URLs. */
export interface EvidenceStorage {
  upload(path: string, bytes: Buffer, contentType: string): Promise<void>;
  signedUrls(paths: readonly string[]): Promise<Map<string, string>>;
}
