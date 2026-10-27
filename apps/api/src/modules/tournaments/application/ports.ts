import type { TournamentConfig, TournamentStatus } from '@league/contracts';

import type {
  AuditRecord,
  PhaseRecord,
  PhaseRow,
  RulebookRecord,
  TemplateRecord,
  TournamentRecord,
} from '../domain/tournament.js';

export interface TournamentAuditEntry {
  readonly action: string;
  readonly sections: readonly string[];
  readonly reason: string | null;
}

export interface TournamentListFilter {
  readonly statuses?: readonly TournamentStatus[];
  /** Public site: only public tournaments that are not drafts. */
  readonly publicOnly?: boolean;
  readonly limit: number;
  readonly offset: number;
}

export interface TournamentRepository {
  /** Throws `tournament_slug_taken`. */
  create(input: {
    organizationId: string;
    actorId: string;
    slug: string;
    templateId: string | null;
    config: TournamentConfig;
  }): Promise<string>;
  slugExists(organizationId: string, slug: string): Promise<boolean>;
  findById(tournamentId: string): Promise<TournamentRecord | null>;
  findBySlug(organizationId: string, slug: string): Promise<TournamentRecord | null>;
  /** Newest start first, then newest created. */
  list(
    organizationId: string,
    filter: TournamentListFilter,
  ): Promise<{ tournaments: TournamentRecord[]; total: number }>;
  /** Writes the config; `phases` regenerates the empty structure; audits and emits when given. */
  update(
    tournamentId: string,
    actorId: string,
    change: {
      config: TournamentConfig;
      phases: readonly PhaseRow[] | null;
      audit: TournamentAuditEntry | null;
      event: string | null;
    },
  ): Promise<void>;
  /** Returns the previous path. */
  setCoverPath(tournamentId: string, path: string, actorId: string): Promise<string | null>;
  /** draft → published: freezes the rulebook draft, creates the phases, audits, emits. */
  publish(tournamentId: string, actorId: string, phases: readonly PhaseRow[]): Promise<void>;
  /** Throws `tournament_status_changed` if the status is no longer `from`. */
  transition(
    tournamentId: string,
    actorId: string,
    change: {
      from: TournamentStatus;
      to: TournamentStatus;
      auditAction: string | null;
      event: string;
      reason: string | null;
    },
  ): Promise<void>;
  phases(tournamentId: string): Promise<PhaseRecord[]>;
  rulebook(tournamentId: string): Promise<RulebookRecord | null>;
  saveRulebookDraft(
    tournamentId: string,
    actorId: string,
    draft: { title: string; content: string; changeSummary: string | null },
  ): Promise<void>;
  /** Throws `no_rulebook_draft`. */
  publishRulebookVersion(tournamentId: string, actorId: string): Promise<void>;
  /** Audit entries of the tournament and of its registrations, newest first. */
  auditTrail(tournamentId: string, limit: number): Promise<AuditRecord[]>;
}

export interface TemplateRepository {
  list(organizationId: string): Promise<TemplateRecord[]>;
  find(templateId: string): Promise<TemplateRecord | null>;
  /** Throws `template_name_taken`. */
  create(input: {
    organizationId: string;
    actorId: string;
    name: string;
    config: TournamentConfig;
  }): Promise<TemplateRecord>;
  delete(templateId: string): Promise<void>;
}

/** From identity (ProfileQueries). */
export interface StaffDirectory {
  isStaff(userId: string): Promise<boolean>;
  summaries(
    userIds: readonly string[],
  ): Promise<Map<string, { username: string | null; displayName: string | null }>>;
}
