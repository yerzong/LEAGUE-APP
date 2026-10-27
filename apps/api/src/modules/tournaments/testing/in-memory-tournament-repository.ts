// Test doubles for TournamentRepository and TemplateRepository with the
// database guarantees the use cases rely on (unique slugs and template names,
// frozen rulebook versions, status checks of the svc_* functions).
import type { TournamentConfig, TournamentStatus } from '@league/contracts';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import type {
  TemplateRepository,
  TournamentAuditEntry,
  TournamentListFilter,
  TournamentRepository,
} from '../application/ports.js';
import type {
  AuditRecord,
  PhaseRecord,
  PhaseRow,
  RulebookRecord,
  RulebookVersionRecord,
  TemplateRecord,
  TournamentRecord,
} from '../domain/tournament.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const raised = (code: string) => new ApplicationError('conflict', code);

export class InMemoryTournamentRepository implements TournamentRepository {
  readonly tournaments: Mutable<TournamentRecord>[] = [];
  readonly phaseRows = new Map<string, PhaseRecord[]>();
  readonly rulebooks = new Map<string, { title: string; versions: RulebookVersionRecord[] }>();
  readonly audit: (TournamentAuditEntry & { tournamentId: string; actorId: string })[] = [];
  readonly events: string[] = [];
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  private nextId(): string {
    this.sequence += 1;
    return `00000000-0000-4000-a000-${String(this.sequence).padStart(12, '0')}`;
  }

  private get(tournamentId: string): Mutable<TournamentRecord> {
    const t = this.tournaments.find((x) => x.id === tournamentId);
    if (!t) throw raised('tournament_not_found');
    return t;
  }

  /** Test helper: a phase status reached by the matches module. */
  setPhaseStatus(tournamentId: string, phaseId: string, status: PhaseRecord['status']): void {
    this.phaseRows.set(
      tournamentId,
      (this.phaseRows.get(tournamentId) ?? []).map((p) =>
        p.id === phaseId ? { ...p, status } : p,
      ),
    );
  }

  /** Test helper: statuses reached in later modules. */
  setStatus(tournamentId: string, status: TournamentStatus): void {
    this.get(tournamentId).status = status;
  }

  private record(tournamentId: string, actorId: string, entry: TournamentAuditEntry): void {
    this.audit.push({ ...entry, tournamentId, actorId });
  }

  create(input: {
    organizationId: string;
    actorId: string;
    slug: string;
    templateId: string | null;
    config: TournamentConfig;
  }): Promise<string> {
    if (
      this.tournaments.some(
        (t) => t.organizationId === input.organizationId && t.slug === input.slug,
      )
    )
      throw conflict('tournament_slug_taken');
    const id = this.nextId();
    this.tournaments.push({
      id,
      organizationId: input.organizationId,
      slug: input.slug,
      status: 'draft',
      config: input.config,
      templateId: input.templateId,
      coverPath: null,
      currentRulebookVersionId: null,
      publishedAt: null,
      createdAt: this.now(),
    });
    this.events.push('tournament.created');
    return Promise.resolve(id);
  }

  slugExists(organizationId: string, slug: string): Promise<boolean> {
    return Promise.resolve(
      this.tournaments.some((t) => t.organizationId === organizationId && t.slug === slug),
    );
  }

  findById(tournamentId: string): Promise<TournamentRecord | null> {
    const t = this.tournaments.find((x) => x.id === tournamentId);
    return Promise.resolve(t ? { ...t } : null);
  }

  findBySlug(organizationId: string, slug: string): Promise<TournamentRecord | null> {
    const t = this.tournaments.find((x) => x.organizationId === organizationId && x.slug === slug);
    return Promise.resolve(t ? { ...t } : null);
  }

  list(
    organizationId: string,
    filter: TournamentListFilter,
  ): Promise<{ tournaments: TournamentRecord[]; total: number }> {
    const matching = this.tournaments
      .filter((t) => t.organizationId === organizationId)
      .filter((t) => !filter.statuses || filter.statuses.includes(t.status))
      .filter(
        (t) =>
          !filter.publicOnly || (t.status !== 'draft' && t.config.basics.visibility === 'public'),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Promise.resolve({
      tournaments: matching
        .slice(filter.offset, filter.offset + filter.limit)
        .map((t) => ({ ...t })),
      total: matching.length,
    });
  }

  update(
    tournamentId: string,
    actorId: string,
    change: {
      config: TournamentConfig;
      phases: readonly PhaseRow[] | null;
      audit: TournamentAuditEntry | null;
      event: string | null;
    },
  ): Promise<void> {
    const t = this.get(tournamentId);
    t.config = change.config;
    if (change.phases) this.replacePhases(tournamentId, change.phases);
    if (change.audit) this.record(tournamentId, actorId, change.audit);
    if (change.event) this.events.push(change.event);
    return Promise.resolve();
  }

  setCoverPath(tournamentId: string, path: string): Promise<string | null> {
    const t = this.get(tournamentId);
    const previous = t.coverPath;
    t.coverPath = path;
    return Promise.resolve(previous);
  }

  private replacePhases(tournamentId: string, rows: readonly PhaseRow[]): void {
    this.phaseRows.set(
      tournamentId,
      rows.map((row) => ({
        id: this.nextId(),
        name: row.name,
        position: row.position,
        format: row.format,
        seriesFormat: row.seriesFormat,
        status: 'pending' as const,
        groups: row.groups.map((name, i) => ({ id: this.nextId(), name, position: i + 1 })),
      })),
    );
  }

  private publishDraft(tournamentId: string): RulebookVersionRecord | null {
    const rulebook = this.rulebooks.get(tournamentId);
    const index = rulebook?.versions.findIndex((v) => v.publishedAt === null) ?? -1;
    const draft = rulebook?.versions[index];
    if (!rulebook || !draft) return null;
    const published = { ...draft, publishedAt: this.now() };
    rulebook.versions[index] = published;
    this.get(tournamentId).currentRulebookVersionId = published.id;
    return published;
  }

  publish(tournamentId: string, actorId: string, phases: readonly PhaseRow[]): Promise<void> {
    const t = this.get(tournamentId);
    if (t.status !== 'draft') throw raised('tournament_not_draft');
    this.publishDraft(tournamentId);
    this.replacePhases(tournamentId, phases);
    t.status = 'published';
    t.publishedAt = this.now();
    this.record(tournamentId, actorId, {
      action: 'tournament.published',
      sections: [],
      reason: null,
    });
    this.events.push('tournament.published');
    return Promise.resolve();
  }

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
  ): Promise<void> {
    const t = this.get(tournamentId);
    if (t.status !== change.from) throw raised('tournament_status_changed');
    t.status = change.to;
    if (change.auditAction)
      this.record(tournamentId, actorId, {
        action: change.auditAction,
        sections: [],
        reason: change.reason,
      });
    this.events.push(change.event);
    return Promise.resolve();
  }

  phases(tournamentId: string): Promise<PhaseRecord[]> {
    return Promise.resolve(this.phaseRows.get(tournamentId) ?? []);
  }

  rulebook(tournamentId: string): Promise<RulebookRecord | null> {
    const rulebook = this.rulebooks.get(tournamentId);
    return Promise.resolve(
      rulebook ? { title: rulebook.title, versions: [...rulebook.versions] } : null,
    );
  }

  saveRulebookDraft(
    tournamentId: string,
    _actorId: string,
    draft: { title: string; content: string; changeSummary: string | null },
  ): Promise<void> {
    const rulebook = this.rulebooks.get(tournamentId) ?? { title: draft.title, versions: [] };
    rulebook.title = draft.title;
    const index = rulebook.versions.findIndex((v) => v.publishedAt === null);
    const existing = rulebook.versions[index];
    if (existing) {
      rulebook.versions[index] = {
        ...existing,
        content: draft.content,
        changeSummary: draft.changeSummary,
      };
    } else {
      rulebook.versions.push({
        id: this.nextId(),
        version: rulebook.versions.length + 1,
        content: draft.content,
        changeSummary: draft.changeSummary,
        publishedAt: null,
      });
    }
    this.rulebooks.set(tournamentId, rulebook);
    return Promise.resolve();
  }

  publishRulebookVersion(tournamentId: string, actorId: string): Promise<void> {
    if (!this.publishDraft(tournamentId)) throw raised('no_rulebook_draft');
    this.record(tournamentId, actorId, {
      action: 'rulebook.version.published',
      sections: [],
      reason: null,
    });
    this.events.push('rulebook.version_published');
    return Promise.resolve();
  }

  auditTrail(tournamentId: string, limit: number): Promise<AuditRecord[]> {
    return Promise.resolve(
      this.audit
        .filter((a) => a.tournamentId === tournamentId)
        .map((a, i) => ({
          id: `00000000-0000-4000-b000-${String(i + 1).padStart(12, '0')}`,
          action: a.action,
          actorUserId: a.actorId,
          entityType: 'tournament',
          entityId: tournamentId,
          before: null,
          after: { sections: a.sections },
          reason: a.reason,
          createdAt: this.now(),
        }))
        .reverse()
        .slice(0, limit),
    );
  }
}

export class InMemoryTemplateRepository implements TemplateRepository {
  readonly templates: (TemplateRecord & { organizationId: string })[] = [];
  private sequence = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  list(organizationId: string): Promise<TemplateRecord[]> {
    return Promise.resolve(this.templates.filter((t) => t.organizationId === organizationId));
  }

  find(templateId: string): Promise<TemplateRecord | null> {
    return Promise.resolve(this.templates.find((t) => t.id === templateId) ?? null);
  }

  create(input: {
    organizationId: string;
    actorId: string;
    name: string;
    config: TournamentConfig;
  }): Promise<TemplateRecord> {
    if (
      this.templates.some(
        (t) =>
          t.organizationId === input.organizationId &&
          t.name.toLowerCase() === input.name.toLowerCase(),
      )
    )
      throw conflict('template_name_taken');
    this.sequence += 1;
    const template = {
      id: `00000000-0000-4000-c000-${String(this.sequence).padStart(12, '0')}`,
      organizationId: input.organizationId,
      name: input.name,
      config: input.config,
      createdAt: this.now(),
    };
    this.templates.push(template);
    return Promise.resolve(template);
  }

  delete(templateId: string): Promise<void> {
    const index = this.templates.findIndex((t) => t.id === templateId);
    if (index >= 0) this.templates.splice(index, 1);
    return Promise.resolve();
  }
}
