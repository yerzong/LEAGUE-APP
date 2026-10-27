import type {
  PhaseConfig,
  TournamentConfig,
  TournamentSection,
  TournamentStatus,
} from '@league/contracts';
import type { PhasePlan } from '@league/core';

import { toSlug } from '../../../shared/slug.js';

export interface TournamentRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly slug: string;
  readonly status: TournamentStatus;
  readonly config: TournamentConfig;
  readonly templateId: string | null;
  readonly coverPath: string | null;
  readonly currentRulebookVersionId: string | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
}

export interface PhaseRecord {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly format: PhaseConfig['format'];
  readonly seriesFormat: PhaseConfig['seriesFormat'];
  readonly status: 'pending' | 'in_progress' | 'completed';
  readonly groups: readonly {
    readonly id: string;
    readonly name: string;
    readonly position: number;
  }[];
}

/** A phase to create on publish (empty: fixtures land in module 05). */
export interface PhaseRow {
  readonly name: string;
  readonly position: number;
  readonly format: PhaseConfig['format'];
  readonly seriesFormat: PhaseConfig['seriesFormat'];
  readonly finalSeriesFormat: PhaseConfig['finalSeriesFormat'];
  readonly draftMode: PhaseConfig['draftMode'];
  readonly points: PhaseConfig['points'];
  readonly tiebreakers: PhaseConfig['tiebreakers'];
  readonly advance: number | null;
  readonly formatConfig: Readonly<Record<string, unknown>>;
  readonly groups: readonly string[];
}

export interface RulebookVersionRecord {
  readonly id: string;
  readonly version: number;
  readonly content: string;
  readonly changeSummary: string | null;
  readonly publishedAt: Date | null;
}

export interface RulebookRecord {
  readonly title: string;
  /** Oldest first. */
  readonly versions: readonly RulebookVersionRecord[];
}

export interface TemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly config: TournamentConfig;
  readonly createdAt: Date;
}

export interface AuditRecord {
  readonly id: string;
  readonly action: string;
  readonly actorUserId: string | null;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly reason: string | null;
  readonly createdAt: Date;
}

export const tournamentSlug = (name: string): string => toSlug(name, 'torneo');

/** The config object the packages/core strategy of the phase format reads. */
export function formatConfigOf(phase: PhaseConfig): Record<string, unknown> {
  const base = { seriesFormat: phase.seriesFormat };
  switch (phase.format) {
    case 'single_elimination':
      return {
        ...base,
        finalSeriesFormat: phase.finalSeriesFormat ?? phase.seriesFormat,
        thirdPlaceMatch: phase.thirdPlaceMatch,
      };
    case 'double_elimination':
      return {
        ...base,
        finalSeriesFormat: phase.finalSeriesFormat ?? phase.seriesFormat,
        grandFinalReset: phase.grandFinalReset,
      };
    case 'round_robin':
      return { ...base, legs: phase.legs };
    case 'double_round_robin':
      return { ...base, legs: 2 };
    case 'groups':
      return { ...base, groupCount: phase.groupCount, legs: phase.legs };
    case 'swiss':
      return { ...base, rounds: phase.rounds };
  }
}

export const phasePlans = (config: TournamentConfig): PhasePlan[] =>
  config.format.phases.map((phase) => ({
    format: phase.format,
    config: formatConfigOf(phase),
    advance: phase.advance,
  }));

const GROUP_NAMES = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
];

export const phaseRows = (config: TournamentConfig): PhaseRow[] =>
  config.format.phases.map((phase, index) => ({
    name: phase.name,
    position: index + 1,
    format: phase.format,
    seriesFormat: phase.seriesFormat,
    finalSeriesFormat: phase.finalSeriesFormat,
    draftMode: phase.draftMode,
    points: phase.points,
    tiebreakers: phase.tiebreakers,
    advance: phase.advance,
    formatConfig: formatConfigOf(phase),
    groups: phase.format === 'groups' ? GROUP_NAMES.slice(0, phase.groupCount ?? 0) : [],
  }));

/** Sections whose content differs (compared as JSON: configs are plain data). */
export function changedSections(
  before: TournamentConfig,
  after: TournamentConfig,
): TournamentSection[] {
  return (Object.keys(after) as TournamentSection[]).filter(
    (section) => JSON.stringify(before[section]) !== JSON.stringify(after[section]),
  );
}

/** What a draft still needs before it can be published (codes for i18n). */
export function publishIssues(
  config: TournamentConfig,
  hasRulebook: boolean,
  previewError: string | null,
): string[] {
  const { schedule } = config;
  return [
    ...(hasRulebook ? [] : ['rulebook_required']),
    ...(config.capacity.capacity === null ? ['capacity_required'] : []),
    ...(schedule.registrationOpensAt && schedule.registrationClosesAt
      ? []
      : ['registration_window_required']),
    ...(schedule.startsAt ? [] : ['start_date_required']),
    ...(previewError ? ['invalid_format'] : []),
  ];
}
