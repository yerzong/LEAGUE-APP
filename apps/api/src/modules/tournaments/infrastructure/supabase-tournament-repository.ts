// Postgres adapter of the tournament ports. The wizard config is split into
// the columns and child tables of docs/03 §6.1 (written by the svc_* functions
// in one transaction) and read back into the same TournamentConfig.
import {
  TournamentConfigSchema,
  type EligibilityRuleConfig,
  type TournamentConfig,
  type TournamentStatus,
} from '@league/contracts';
import type { Json, Tables } from '@league/db';

import { ApplicationError, conflict } from '../../../shared/application-error.js';
import {
  assertNoError,
  isUniqueViolation,
  raisedCode,
} from '../../../shared/database/postgres-errors.js';
import type { AdminClient } from '../../../shared/database/supabase-admin.js';
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
  TemplateRecord,
  TournamentRecord,
} from '../domain/tournament.js';

const SELECT = `*,
  tournament_game_settings(*),
  tournament_roster_rules(*),
  eligibility_rules(*),
  schedule_windows(*),
  schedule_blackouts(*),
  tournament_prizes(*),
  circuit_tournaments(circuit_id)`;

type Row = Tables<'tournaments'> & {
  tournament_game_settings: Tables<'tournament_game_settings'> | null;
  tournament_roster_rules: Tables<'tournament_roster_rules'> | null;
  eligibility_rules: Tables<'eligibility_rules'>[];
  schedule_windows: Tables<'schedule_windows'>[];
  schedule_blackouts: Tables<'schedule_blackouts'>[];
  tournament_prizes: Tables<'tournament_prizes'>[];
  circuit_tournaments: { circuit_id: string } | { circuit_id: string }[] | null;
};

/** Parts of the config without a column of their own (TournamentSettingsSchema v1). */
interface Settings {
  format: TournamentConfig['format'];
  fee: TournamentConfig['participants']['fee'];
  checkinOpensMinutes: number;
  checkinClosesMinutes: number;
  rescheduleWithinWindowsOnly: boolean;
  featuredMatches: boolean;
  communication: TournamentConfig['communication'];
}

const raisedConflicts = new Set([
  'tournament_not_found',
  'tournament_not_draft',
  'tournament_status_changed',
  'no_rulebook_draft',
  'phases_in_use',
  'rulebook_version_published',
]);

function check(error: Parameters<typeof raisedCode>[0]): void {
  const code = raisedCode(error);
  if (code && raisedConflicts.has(code)) throw new ApplicationError('conflict', code);
  assertNoError(error);
}

const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);
const hhmm = (time: string) => time.slice(0, 5);

/** Flat payload of private.apply_tournament_config. */
function toPayload(config: TournamentConfig): Json {
  const { basics, capacity, participants, game, eligibility, roster, schedule, broadcast } = config;
  const settings: Settings = {
    format: config.format,
    fee: participants.fee,
    checkinOpensMinutes: schedule.checkinOpensMinutes,
    checkinClosesMinutes: schedule.checkinClosesMinutes,
    rescheduleWithinWindowsOnly: schedule.rescheduleWithinWindowsOnly,
    featuredMatches: broadcast.featuredMatches,
    communication: config.communication,
  };
  return {
    tournament: {
      name: basics.name,
      type: basics.type,
      tier: basics.tier,
      visibility: basics.visibility,
      description: basics.description,
      timezone: basics.timezone,
      season_id: basics.seasonId,
      capacity: capacity.capacity,
      waitlist_enabled: capacity.waitlistEnabled,
      entrant_kind: participants.entrantKind,
      team_source: participants.teamSource,
      participant_policy: participants.participantPolicy,
      max_rosters_per_club: participants.maxRostersPerClub,
      modality: participants.modality,
      venue: participants.venue,
      registration_opens_at: schedule.registrationOpensAt,
      registration_closes_at: schedule.registrationClosesAt,
      starts_at: schedule.startsAt,
      ends_at: schedule.endsAt,
      has_prizes: config.prizes.hasPrizes,
      prize_pool_summary: config.prizes.poolSummary,
      exclusivity_scope: eligibility.exclusivityScope,
      supervision_level: config.supervision.level,
      costream_policy: broadcast.costreamPolicy,
      costream_delay_seconds: broadcast.costreamDelaySeconds,
      settings: settings as unknown as Json,
      schema_version: 1,
    },
    game: {
      team_size: game.teamSize,
      map: game.map,
      pick_type: game.pickType,
      spectator_type: game.spectatorType,
      custom_win_condition: game.customWinCondition,
    },
    roster: {
      starters: roster.starters,
      max_substitutes: roster.maxSubstitutes,
      coach_allowed: roster.coachAllowed,
      max_roster_changes: roster.maxRosterChanges,
      min_games_for_playoffs: roster.minGamesForPlayoffs,
      leave_cooldown_days: roster.leaveCooldownDays,
    },
    eligibility: eligibility.rules.map((rule) => ({
      rule_type: rule.type,
      params: 'params' in rule ? rule.params : {},
      applies_to: 'appliesTo' in rule && rule.appliesTo ? rule.appliesTo : 'player',
    })),
    windows: schedule.windows.map((w) => ({
      weekday: w.weekday,
      start_time: w.startTime,
      end_time: w.endTime,
      slot_minutes: w.slotMinutes,
      parallel_matches: w.parallelMatches,
    })),
    blackouts: schedule.blackouts.map((b) => ({
      starts_at: b.startsAt,
      ends_at: b.endsAt,
      reason: b.reason,
    })),
    prizes: config.prizes.items.map((p) => ({
      award_type: p.awardType,
      placement_from: p.placementFrom,
      placement_to: p.placementTo,
      label: p.label,
      prize_type: p.prizeType,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      quantity: p.quantity,
      distribution: p.distribution,
    })),
    circuit_id: eligibility.circuitId,
  };
}

function toConfig(row: Row): TournamentConfig {
  const settings = row.settings as unknown as Settings;
  const game = row.tournament_game_settings;
  const roster = row.tournament_roster_rules;
  const circuit = Array.isArray(row.circuit_tournaments)
    ? row.circuit_tournaments[0]
    : row.circuit_tournaments;
  const byPosition = <T extends { position: number }>(list: T[]) =>
    [...list].sort((a, b) => a.position - b.position);

  // Parsed so that stored and submitted configs share one shape (see changedSections).
  return TournamentConfigSchema.parse({
    basics: {
      name: row.name,
      type: row.type,
      tier: row.tier,
      visibility: row.visibility,
      description: row.description,
      timezone: row.timezone,
      seasonId: row.season_id,
    },
    capacity: { capacity: row.capacity, waitlistEnabled: row.waitlist_enabled },
    participants: {
      entrantKind: row.entrant_kind,
      teamSource: row.team_source,
      participantPolicy: row.participant_policy,
      maxRostersPerClub: row.max_rosters_per_club,
      modality: row.modality,
      venue: row.venue,
      fee: settings.fee,
    },
    game: {
      teamSize: game?.team_size,
      map: game?.map,
      pickType: game?.pick_type,
      spectatorType: game?.spectator_type,
      customWinCondition: game?.custom_win_condition ?? null,
    },
    eligibility: {
      exclusivityScope: row.exclusivity_scope,
      circuitId: circuit?.circuit_id ?? null,
      rules: byPosition(row.eligibility_rules)
        .filter((r) => r.is_active)
        .map(
          (r) =>
            ({
              type: r.rule_type,
              params: r.params,
              appliesTo: r.applies_to,
            }) as unknown as EligibilityRuleConfig,
        ),
    },
    roster: {
      starters: roster?.starters,
      maxSubstitutes: roster?.max_substitutes,
      coachAllowed: roster?.coach_allowed,
      maxRosterChanges: roster?.max_roster_changes ?? null,
      minGamesForPlayoffs: roster?.min_games_for_playoffs ?? null,
      leaveCooldownDays: roster?.leave_cooldown_days,
    },
    format: settings.format,
    schedule: {
      registrationOpensAt: iso(row.registration_opens_at),
      registrationClosesAt: iso(row.registration_closes_at),
      startsAt: iso(row.starts_at),
      endsAt: iso(row.ends_at),
      windows: row.schedule_windows
        .filter((w) => w.phase_id === null)
        .map((w) => ({
          weekday: w.weekday,
          startTime: hhmm(w.start_time),
          endTime: hhmm(w.end_time),
          slotMinutes: w.slot_minutes,
          parallelMatches: w.parallel_matches,
        })),
      blackouts: row.schedule_blackouts.map((b) => ({
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        reason: b.reason,
      })),
      checkinOpensMinutes: settings.checkinOpensMinutes,
      checkinClosesMinutes: settings.checkinClosesMinutes,
      rescheduleWithinWindowsOnly: settings.rescheduleWithinWindowsOnly,
    },
    broadcast: {
      featuredMatches: settings.featuredMatches,
      costreamPolicy: row.costream_policy,
      costreamDelaySeconds: row.costream_delay_seconds,
    },
    supervision: { level: row.supervision_level },
    communication: settings.communication,
    prizes: {
      hasPrizes: row.has_prizes,
      poolSummary: row.prize_pool_summary,
      items: byPosition(row.tournament_prizes).map((p) => ({
        awardType: p.award_type,
        placementFrom: p.placement_from,
        placementTo: p.placement_to,
        label: p.label,
        prizeType: p.prize_type,
        description: p.description,
        amount: p.amount,
        currency: p.currency,
        quantity: p.quantity,
        distribution: p.distribution,
      })),
    },
  });
}

const toRecord = (row: Row): TournamentRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  slug: row.slug,
  status: row.status,
  config: toConfig(row),
  templateId: row.template_id,
  coverPath: row.cover_path,
  currentRulebookVersionId: row.current_rulebook_version_id,
  publishedAt: row.published_at ? new Date(row.published_at) : null,
  createdAt: new Date(row.created_at),
});

const toPhasePayload = (phases: readonly PhaseRow[]): Json =>
  phases.map((p) => ({
    name: p.name,
    position: p.position,
    format: p.format,
    series_format: p.seriesFormat,
    final_series_format: p.finalSeriesFormat,
    draft_mode: p.draftMode,
    points_config: p.points,
    tiebreakers: [...p.tiebreakers],
    advancement: { count: p.advance },
    format_config: p.formatConfig as Json,
    groups: [...p.groups],
  }));

export class SupabaseTournamentRepository implements TournamentRepository {
  constructor(private readonly db: AdminClient) {}

  private tournaments() {
    return this.db.from('tournaments').select(SELECT).is('deleted_at', null);
  }

  async create(input: {
    organizationId: string;
    actorId: string;
    slug: string;
    templateId: string | null;
    config: TournamentConfig;
  }): Promise<string> {
    const { data, error } = await this.db.rpc('svc_create_tournament', {
      p_organization_id: input.organizationId,
      p_actor: input.actorId,
      p_slug: input.slug,
      // The generated type marks it required; SQL accepts null.
      p_template_id: input.templateId as string,
      p_config: toPayload(input.config),
    });
    if (isUniqueViolation(error, 'tournaments_organization_id_slug_key'))
      throw conflict('tournament_slug_taken');
    check(error);
    return data as string;
  }

  async slugExists(organizationId: string, slug: string): Promise<boolean> {
    const { count, error } = await this.db
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('slug', slug);
    check(error);
    return (count ?? 0) > 0;
  }

  async findById(tournamentId: string): Promise<TournamentRecord | null> {
    const { data, error } = await this.tournaments().eq('id', tournamentId).maybeSingle();
    check(error);
    return data ? toRecord(data) : null;
  }

  async findBySlug(organizationId: string, slug: string): Promise<TournamentRecord | null> {
    const { data, error } = await this.tournaments()
      .eq('organization_id', organizationId)
      .eq('slug', slug)
      .maybeSingle();
    check(error);
    return data ? toRecord(data) : null;
  }

  async list(
    organizationId: string,
    filter: TournamentListFilter,
  ): Promise<{ tournaments: TournamentRecord[]; total: number }> {
    let select = this.db
      .from('tournaments')
      .select(SELECT, { count: 'exact' })
      .is('deleted_at', null)
      .eq('organization_id', organizationId);
    if (filter.statuses) select = select.in('status', [...filter.statuses]);
    if (filter.publicOnly) select = select.eq('visibility', 'public').neq('status', 'draft');
    const { data, count, error } = await select
      .order('starts_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .range(filter.offset, filter.offset + filter.limit - 1);
    check(error);
    return {
      tournaments: ((data ?? []) as unknown as Row[]).map(toRecord),
      total: count ?? 0,
    };
  }

  async update(
    tournamentId: string,
    actorId: string,
    change: {
      config: TournamentConfig;
      phases: readonly PhaseRow[] | null;
      audit: TournamentAuditEntry | null;
      event: string | null;
    },
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_update_tournament', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
      p_config: toPayload(change.config),
      // The generated types mark these required; SQL accepts null.
      p_phases: change.phases ? toPhasePayload(change.phases) : null,
      p_audit_action: (change.audit?.action ?? null) as string,
      p_event_type: change.event as string,
      p_changes: (change.audit ? { sections: [...change.audit.sections] } : null) as Json,
      p_reason: (change.audit?.reason ?? null) as string,
    });
    check(error);
  }

  async setCoverPath(tournamentId: string, path: string, actorId: string): Promise<string | null> {
    const { data: previous, error: readError } = await this.db
      .from('tournaments')
      .select('cover_path')
      .eq('id', tournamentId)
      .maybeSingle();
    check(readError);
    const { error } = await this.db
      .from('tournaments')
      .update({ cover_path: path, updated_by: actorId })
      .eq('id', tournamentId);
    check(error);
    return previous?.cover_path ?? null;
  }

  async publish(tournamentId: string, actorId: string, phases: readonly PhaseRow[]): Promise<void> {
    const { error } = await this.db.rpc('svc_publish_tournament', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
      p_phases: toPhasePayload(phases),
    });
    check(error);
  }

  async transition(
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
    const { error } = await this.db.rpc('svc_transition_tournament', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
      p_from: change.from,
      p_to: change.to,
      p_audit_action: change.auditAction as string,
      p_event_type: change.event,
      p_reason: change.reason as string,
    });
    check(error);
  }

  async phases(tournamentId: string): Promise<PhaseRecord[]> {
    const { data, error } = await this.db
      .from('phases')
      .select('id, name, position, format, series_format, status, groups(id, name, position)')
      .eq('tournament_id', tournamentId)
      .order('position');
    check(error);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      // Only the formats of packages/core are ever written.
      format: p.format as PhaseRecord['format'],
      seriesFormat: p.series_format,
      status: p.status,
      groups: [...p.groups]
        .sort((a, b) => a.position - b.position)
        .map((g) => ({ id: g.id, name: g.name, position: g.position })),
    }));
  }

  async rulebook(tournamentId: string): Promise<RulebookRecord | null> {
    const { data, error } = await this.db
      .from('rulebooks')
      .select('title, rulebook_versions(id, version, content, change_summary, published_at)')
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    check(error);
    if (!data) return null;
    return {
      title: data.title,
      versions: [...data.rulebook_versions]
        .sort((a, b) => a.version - b.version)
        .map((v) => ({
          id: v.id,
          version: v.version,
          content: v.content,
          changeSummary: v.change_summary,
          publishedAt: v.published_at ? new Date(v.published_at) : null,
        })),
    };
  }

  async saveRulebookDraft(
    tournamentId: string,
    actorId: string,
    draft: { title: string; content: string; changeSummary: string | null },
  ): Promise<void> {
    const { error } = await this.db.rpc('svc_save_rulebook_draft', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
      p_title: draft.title,
      p_content: draft.content,
      p_change_summary: draft.changeSummary as string,
    });
    check(error);
  }

  async publishRulebookVersion(tournamentId: string, actorId: string): Promise<void> {
    const { error } = await this.db.rpc('svc_publish_rulebook_version', {
      p_tournament_id: tournamentId,
      p_actor: actorId,
    });
    check(error);
  }

  async auditTrail(tournamentId: string, limit: number): Promise<AuditRecord[]> {
    const { data: entrants, error: entrantsError } = await this.db
      .from('entrants')
      .select('id')
      .eq('tournament_id', tournamentId);
    check(entrantsError);
    const ids = [tournamentId, ...(entrants ?? []).map((e) => e.id)];
    const { data, error } = await this.db
      .from('audit_logs')
      .select('*')
      .in('entity_id', ids)
      .in('entity_type', ['tournament', 'entrant'])
      .order('created_at', { ascending: false })
      .limit(limit);
    check(error);
    return (data ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      actorUserId: a.actor_user_id,
      entityType: a.entity_type,
      entityId: a.entity_id,
      before: a.before as Record<string, unknown> | null,
      after: a.after as Record<string, unknown> | null,
      reason: a.reason,
      createdAt: new Date(a.created_at),
    }));
  }
}

const toTemplate = (row: Tables<'tournament_templates'>): TemplateRecord => ({
  id: row.id,
  name: row.name,
  config: TournamentConfigSchema.parse(row.config),
  createdAt: new Date(row.created_at),
});

export class SupabaseTemplateRepository implements TemplateRepository {
  constructor(private readonly db: AdminClient) {}

  async list(organizationId: string): Promise<TemplateRecord[]> {
    const { data, error } = await this.db
      .from('tournament_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');
    check(error);
    return (data ?? []).map(toTemplate);
  }

  async find(templateId: string): Promise<TemplateRecord | null> {
    const { data, error } = await this.db
      .from('tournament_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    check(error);
    return data ? toTemplate(data) : null;
  }

  async create(input: {
    organizationId: string;
    actorId: string;
    name: string;
    config: TournamentConfig;
  }): Promise<TemplateRecord> {
    const { data, error } = await this.db
      .from('tournament_templates')
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        config: input.config as unknown as Json,
        created_by: input.actorId,
        updated_by: input.actorId,
      })
      .select('*')
      .single();
    if (isUniqueViolation(error, 'tournament_templates_name_key'))
      throw conflict('template_name_taken');
    check(error);
    return toTemplate(data as Tables<'tournament_templates'>);
  }

  async delete(templateId: string): Promise<void> {
    const { error } = await this.db.from('tournament_templates').delete().eq('id', templateId);
    check(error);
  }
}
