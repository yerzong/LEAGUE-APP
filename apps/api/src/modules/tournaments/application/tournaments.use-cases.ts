// Tournament use cases: staff check, rules from packages/core (lifecycle, edit
// policy, structure preview), then the repository (which audits and emits).

import {
  ReasonSchema,
  TOURNAMENT_ACTIONS,
  type AuditEntry,
  type CreateTemplateRequest,
  type CreateTournamentRequest,
  type PhaseShape,
  type PublicParticipant,
  type PublicTournamentDetail,
  type PublicTournamentListItem,
  type RulebookDraftRequest,
  type RulebookVersion,
  type TournamentAction,
  type TournamentActionRequest,
  type TournamentConfig,
  type TournamentDetail,
  type TournamentStatus,
  type TournamentSummary,
  type TournamentTemplate,
  type UpdateTournamentRequest,
} from '@league/contracts';
import {
  changesNeedingConfirmation,
  describeStructure,
  DomainError,
  editPolicy,
  tournamentLifecycle,
} from '@league/core';

import {
  ApplicationError,
  conflict,
  forbidden,
  notFound,
} from '../../../shared/application-error.js';
import { uniqueSlug } from '../../../shared/slug.js';
import { validateImage, type UploadedImage } from '../../../shared/storage/image.js';
import {
  changedSections,
  phasePlans,
  phaseRows,
  publishIssues,
  tournamentSlug,
  type RulebookVersionRecord,
  type TemplateRecord,
  type TournamentRecord,
} from '../domain/tournament.js';
import type { TournamentsDeps } from './deps.js';
import type { TournamentListFilter } from './ports.js';

/** Event (and audit action) of each lifecycle action. */
const ACTION_EVENTS: Readonly<Record<Exclude<TournamentAction, 'publish'>, string>> = {
  open_registration: 'tournament.registration_opened',
  close_registration: 'tournament.registration_closed',
  reopen_registration: 'tournament.registration_reopened',
  cancel: 'tournament.canceled',
  archive: 'tournament.archived',
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function requireStaff(deps: Pick<TournamentsDeps, 'staff'>, userId: string) {
  if (!(await deps.staff.isStaff(userId))) throw forbidden('staff_only');
}

async function loadTournament(deps: TournamentsDeps, tournamentId: string) {
  const tournament = await deps.tournaments.findById(tournamentId);
  if (!tournament) throw notFound('tournament_not_found');
  return tournament;
}

/** Phase shapes for the capacity; a format the strategies reject gives its error code. */
function previewStructure(
  deps: Pick<TournamentsDeps, 'formats'>,
  config: TournamentConfig,
): { shapes: PhaseShape[]; error: string | null } {
  if (config.capacity.capacity === null) return { shapes: [], error: null };
  try {
    return {
      shapes: describeStructure(deps.formats, phasePlans(config), config.capacity.capacity).map(
        (s) => ({ ...s, groups: [...s.groups] }),
      ),
      error: null,
    };
  } catch (error) {
    if (error instanceof DomainError) return { shapes: [], error: error.code };
    throw error;
  }
}

function toSummary(deps: TournamentsDeps, t: TournamentRecord): TournamentSummary {
  const { basics, capacity, participants, game, schedule } = t.config;
  return {
    id: t.id,
    slug: t.slug,
    name: basics.name,
    type: basics.type,
    tier: basics.tier,
    status: t.status,
    visibility: basics.visibility,
    coverUrl: deps.storage.publicUrl('tournament-covers', t.coverPath),
    entrantKind: participants.entrantKind,
    teamSize: game.teamSize,
    capacity: capacity.capacity,
    registrationOpensAt: schedule.registrationOpensAt,
    registrationClosesAt: schedule.registrationClosesAt,
    startsAt: schedule.startsAt,
    createdAt: t.createdAt.toISOString(),
  };
}

const toVersion = (v: RulebookVersionRecord): RulebookVersion => ({
  id: v.id,
  version: v.version,
  content: v.content,
  changeSummary: v.changeSummary,
  publishedAt: v.publishedAt?.toISOString() ?? null,
});

const availableActions = (status: TournamentStatus): TournamentAction[] =>
  tournamentLifecycle
    .availableEvents(status)
    .filter((e): e is TournamentAction => (TOURNAMENT_ACTIONS as readonly string[]).includes(e));

async function buildDetail(deps: TournamentsDeps, t: TournamentRecord): Promise<TournamentDetail> {
  const [phases, rulebook] = await Promise.all([
    deps.tournaments.phases(t.id),
    deps.tournaments.rulebook(t.id),
  ]);
  const preview = previewStructure(deps, t.config);
  const current = rulebook?.versions.find((v) => v.id === t.currentRulebookVersionId) ?? null;
  const draft = rulebook?.versions.find((v) => v.publishedAt === null) ?? null;
  return {
    ...toSummary(deps, t),
    config: t.config,
    templateId: t.templateId,
    publishedAt: t.publishedAt?.toISOString() ?? null,
    phases: phases.map((p) => ({ ...p, groups: [...p.groups] })),
    rulebook: rulebook
      ? {
          title: rulebook.title,
          current: current ? toVersion(current) : null,
          draft: draft ? toVersion(draft) : null,
          versions: rulebook.versions.map(({ content: _content, ...v }) => ({
            ...v,
            publishedAt: v.publishedAt?.toISOString() ?? null,
          })),
        }
      : null,
    editPolicy: { ...editPolicy(t.status) },
    actions: availableActions(t.status),
    preview,
    publishIssues:
      t.status === 'draft'
        ? publishIssues(t.config, draft !== null || current !== null, preview.error)
        : [],
  };
}

const toTemplate = (t: TemplateRecord): TournamentTemplate => ({
  id: t.id,
  name: t.name,
  config: t.config,
  createdAt: t.createdAt.toISOString(),
});

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

export class ListTournamentsUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string): Promise<TournamentSummary[]> {
    await requireStaff(this.deps, userId);
    const { tournaments } = await this.deps.tournaments.list(await this.deps.organization.id(), {
      limit: 200,
      offset: 0,
    });
    return tournaments.map((t) => toSummary(this.deps, t));
  }
}

export class CreateTournamentUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string, input: CreateTournamentRequest): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    const organizationId = await this.deps.organization.id();
    if (input.templateId && !(await this.deps.templates.find(input.templateId)))
      throw notFound('template_not_found');
    const slug = await uniqueSlug(tournamentSlug(input.config.basics.name), (candidate) =>
      this.deps.tournaments.slugExists(organizationId, candidate),
    );
    const id = await this.deps.tournaments.create({
      organizationId,
      actorId: userId,
      slug,
      templateId: input.templateId,
      config: input.config,
    });
    return buildDetail(this.deps, await loadTournament(this.deps, id));
  }
}

export class GetTournamentUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string, tournamentId: string): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    return buildDetail(this.deps, await loadTournament(this.deps, tournamentId));
  }
}

export class UpdateTournamentUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  /** The slug stays on rename: links keep working. */
  async execute(
    userId: string,
    tournamentId: string,
    input: UpdateTournamentRequest,
  ): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    const tournament = await loadTournament(this.deps, tournamentId);
    const changed = changedSections(tournament.config, input.config);
    // Throws LockedSectionError for a section locked in this status.
    const needConfirmation = changesNeedingConfirmation(tournament.status, changed);
    if (needConfirmation.length > 0 && !input.confirm)
      throw conflict('confirmation_required', { sections: needConfirmation });

    const isDraft = tournament.status === 'draft';
    const regenerate = !isDraft && changed.includes('format');
    if (regenerate && previewStructure(this.deps, input.config).error)
      throw conflict('invalid_format');

    await this.deps.tournaments.update(tournamentId, userId, {
      config: input.config,
      phases: regenerate ? phaseRows(input.config) : null,
      audit:
        isDraft || changed.length === 0
          ? null
          : { action: 'tournament.config.updated', sections: changed, reason: input.reason },
      event:
        isDraft || changed.length === 0
          ? null
          : needConfirmation.length > 0
            ? 'tournament.rules_changed'
            : 'tournament.updated',
    });
    return buildDetail(this.deps, await loadTournament(this.deps, tournamentId));
  }
}

export class UploadTournamentCoverUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(
    userId: string,
    tournamentId: string,
    file: UploadedImage | undefined,
  ): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    const image = validateImage(file);
    await loadTournament(this.deps, tournamentId);
    const path = `${tournamentId}/${this.deps.newId()}.${image.extension}`;
    await this.deps.storage.upload('tournament-covers', path, image.bytes, image.type);
    const previous = await this.deps.tournaments.setCoverPath(tournamentId, path, userId);
    if (previous) await this.deps.storage.remove('tournament-covers', previous);
    return buildDetail(this.deps, await loadTournament(this.deps, tournamentId));
  }
}

export class RunTournamentActionUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(
    userId: string,
    tournamentId: string,
    action: TournamentAction,
    input: TournamentActionRequest,
  ): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    const tournament = await loadTournament(this.deps, tournamentId);
    // Registration counts only guard start_seeding, which is not an action here.
    const to = tournamentLifecycle.transition(
      tournament.status,
      { type: action },
      {
        phaseCount: tournament.config.format.phases.length,
        approvedEntrants: 0,
        minEntrants: 0,
        allPhasesCompleted: false,
      },
    );

    if (action === 'publish') {
      const detail = await buildDetail(this.deps, tournament);
      if (detail.publishIssues.length > 0)
        throw conflict('publish_incomplete', { issues: detail.publishIssues });
      await this.deps.tournaments.publish(tournamentId, userId, phaseRows(tournament.config));
    } else {
      if (action === 'cancel' && !ReasonSchema.safeParse(input.reason ?? '').success)
        throw new ApplicationError('invalid', 'reason_required');
      const event = ACTION_EVENTS[action];
      await this.deps.tournaments.transition(tournamentId, userId, {
        from: tournament.status,
        to,
        auditAction: event,
        event,
        reason: input.reason,
      });
    }
    return buildDetail(this.deps, await loadTournament(this.deps, tournamentId));
  }
}

export class GetTournamentAuditUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string, tournamentId: string): Promise<AuditEntry[]> {
    await requireStaff(this.deps, userId);
    await loadTournament(this.deps, tournamentId);
    const entries = await this.deps.tournaments.auditTrail(tournamentId, 200);
    const actors = await this.deps.staff.summaries([
      ...new Set(entries.flatMap((e) => (e.actorUserId ? [e.actorUserId] : []))),
    ]);
    return entries.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actorUserId ? (actors.get(e.actorUserId) ?? null) : null,
      entityType: e.entityType,
      entityId: e.entityId,
      before: e.before,
      after: e.after,
      reason: e.reason,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

// ---------------------------------------------------------------------------
// Rulebook
// ---------------------------------------------------------------------------

export class SaveRulebookDraftUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(
    userId: string,
    tournamentId: string,
    input: RulebookDraftRequest,
  ): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    await loadTournament(this.deps, tournamentId);
    await this.deps.tournaments.saveRulebookDraft(tournamentId, userId, input);
    return buildDetail(this.deps, await loadTournament(this.deps, tournamentId));
  }
}

export class PublishRulebookVersionUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  /** A new version for a published tournament (the first one is frozen on publish). */
  async execute(userId: string, tournamentId: string): Promise<TournamentDetail> {
    await requireStaff(this.deps, userId);
    const tournament = await loadTournament(this.deps, tournamentId);
    if (tournament.status === 'draft') throw conflict('tournament_not_published');
    await this.deps.tournaments.publishRulebookVersion(tournamentId, userId);
    return buildDetail(this.deps, await loadTournament(this.deps, tournamentId));
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export class ListTemplatesUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string): Promise<TournamentTemplate[]> {
    await requireStaff(this.deps, userId);
    return (await this.deps.templates.list(await this.deps.organization.id())).map(toTemplate);
  }
}

export class GetTemplateUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string, templateId: string): Promise<TournamentTemplate> {
    await requireStaff(this.deps, userId);
    const template = await this.deps.templates.find(templateId);
    if (!template) throw notFound('template_not_found');
    return toTemplate(template);
  }
}

export class CreateTemplateUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string, input: CreateTemplateRequest): Promise<TournamentTemplate> {
    await requireStaff(this.deps, userId);
    return toTemplate(
      await this.deps.templates.create({
        organizationId: await this.deps.organization.id(),
        actorId: userId,
        name: input.name,
        config: input.config,
      }),
    );
  }
}

export class DeleteTemplateUseCase {
  constructor(private readonly deps: TournamentsDeps) {}

  async execute(userId: string, templateId: string): Promise<void> {
    await requireStaff(this.deps, userId);
    if (!(await this.deps.templates.find(templateId))) throw notFound('template_not_found');
    await this.deps.templates.delete(templateId);
  }
}

// ---------------------------------------------------------------------------
// Read API for other modules (registrations, public site)
// ---------------------------------------------------------------------------

export class TournamentQueries {
  constructor(private readonly deps: TournamentsDeps) {}

  findById(tournamentId: string): Promise<TournamentRecord | null> {
    return this.deps.tournaments.findById(tournamentId);
  }

  async findBySlug(slug: string): Promise<TournamentRecord | null> {
    return this.deps.tournaments.findBySlug(await this.deps.organization.id(), slug);
  }

  async list(filter: TournamentListFilter) {
    return this.deps.tournaments.list(await this.deps.organization.id(), filter);
  }

  phases(tournamentId: string) {
    return this.deps.tournaments.phases(tournamentId);
  }

  /** The published version registrations accept. */
  async currentRulebook(tournament: TournamentRecord): Promise<RulebookVersionRecord | null> {
    if (!tournament.currentRulebookVersionId) return null;
    const rulebook = await this.deps.tournaments.rulebook(tournament.id);
    return rulebook?.versions.find((v) => v.id === tournament.currentRulebookVersionId) ?? null;
  }

  /** Version number of each rulebook version id (registrations store the id). */
  async rulebookVersionNumbers(tournamentId: string): Promise<Map<string, number>> {
    const rulebook = await this.deps.tournaments.rulebook(tournamentId);
    return new Map((rulebook?.versions ?? []).map((v) => [v.id, v.version]));
  }

  coverUrl(path: string | null): string | null {
    return this.deps.storage.publicUrl('tournament-covers', path);
  }

  listItem(t: TournamentRecord, approvedCount: number): PublicTournamentListItem {
    const { basics, capacity, participants, game, schedule, prizes } = t.config;
    return {
      id: t.id,
      slug: t.slug,
      name: basics.name,
      type: basics.type,
      tier: basics.tier,
      status: t.status,
      coverUrl: this.coverUrl(t.coverPath),
      entrantKind: participants.entrantKind,
      teamSize: game.teamSize,
      map: game.map,
      modality: participants.modality,
      capacity: capacity.capacity,
      approvedCount,
      registrationOpensAt: schedule.registrationOpensAt,
      registrationClosesAt: schedule.registrationClosesAt,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      hasPrizes: prizes.hasPrizes,
      prizePoolSummary: prizes.poolSummary,
    };
  }

  /** Everything the public detail page shows; participants come from registrations. */
  async publicDetail(
    t: TournamentRecord,
    participants: readonly PublicParticipant[],
  ): Promise<PublicTournamentDetail> {
    const [phases, rulebook] = await Promise.all([this.phases(t.id), this.currentRulebook(t)]);
    const { basics, participants: who, game, eligibility, roster, schedule, prizes } = t.config;
    const groupsByPosition = new Map(phases.map((p) => [p.position, p.groups.map((g) => g.name)]));
    return {
      ...this.listItem(t, participants.length),
      description: basics.description,
      timezone: basics.timezone,
      venue: who.venue,
      pickType: game.pickType,
      customWinCondition: game.customWinCondition,
      fee: who.fee,
      supervisionLevel: t.config.supervision.level,
      phases: t.config.format.phases.map((phase, i) => ({
        name: phase.name,
        position: i + 1,
        format: phase.format,
        seriesFormat: phase.seriesFormat,
        finalSeriesFormat: phase.finalSeriesFormat,
        draftMode: phase.draftMode,
        advance: phase.advance,
        groups: groupsByPosition.get(i + 1) ?? [],
      })),
      eligibility: { exclusivityScope: eligibility.exclusivityScope, rules: eligibility.rules },
      roster: {
        starters: roster.starters,
        maxSubstitutes: roster.maxSubstitutes,
        coachAllowed: roster.coachAllowed,
      },
      windows: schedule.windows,
      prizes: prizes.hasPrizes ? prizes.items : [],
      rulebook: rulebook?.publishedAt
        ? {
            id: rulebook.id,
            version: rulebook.version,
            content: rulebook.content,
            publishedAt: rulebook.publishedAt.toISOString(),
          }
        : null,
      participants: [...participants],
    };
  }

  isStaff(userId: string): Promise<boolean> {
    return this.deps.staff.isStaff(userId);
  }
}
