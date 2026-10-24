export { CORE_VERSION } from './version.js';

export type * from './types.js';
export * from './errors.js';

// Series
export {
  maxGames,
  resolveSeries,
  winsNeeded,
  type SeriesInput,
  type SeriesOutcome,
} from './series/series.js';

// Points, standings and tiebreakers
export {
  buildRecords,
  DEFAULT_POINTS_RULE,
  type EntrantRecord,
  type PointsBonus,
  type PointsRule,
} from './standings/points.js';
export {
  computeTable,
  requiresManualTiebreak,
  type Standing,
  type TableInput,
} from './standings/standings.js';
export {
  resolveTie,
  TIEBREAK_CRITERIA,
  type TiebreakCriterion,
  type TiebreakCriterionKind,
  type TiebreakRule,
  type TiebreakStep,
} from './standings/tiebreakers.js';

// Phase formats
export type {
  AdvancementConfig,
  AdvancementResult,
  BaseFormatConfig,
  PhaseFormatStrategy,
} from './formats/strategy.js';
export {
  createFormatRegistry,
  PhaseFormatRegistry,
  type PhaseFormat,
  type PhaseFormatConfigs,
} from './formats/registry.js';
export {
  doubleRoundRobin,
  roundRobin,
  scheduleRoundRobin,
  type RoundRobinConfig,
} from './formats/round-robin.js';
export { assignGroups, groups, type GroupsConfig } from './formats/groups.js';
export {
  singleElimination,
  THIRD_PLACE_MATCH_ID,
  type SingleEliminationConfig,
} from './formats/single-elimination.js';
export {
  doubleElimination,
  GRAND_FINAL_ID,
  GRAND_FINAL_RESET_ID,
  type DoubleEliminationConfig,
} from './formats/double-elimination.js';
export { pairNextSwissRound, swiss, type SwissConfig } from './formats/swiss.js';
export { bracketOrder } from './formats/bracket.js';

// Fearless
export {
  computeFearlessLocks,
  lockedChampions,
  validateDraft,
  type DraftValidation,
  type DraftViolation,
  type FearlessLock,
  type FearlessMode,
  type FearlessOptions,
  type FearlessSeries,
} from './fearless/fearless.js';

// Eligibility
export {
  assertEligible,
  evaluateEligibility,
  type EligibilityCandidate,
  type EligibilityContext,
  type EligibilityFailure,
  type EligibilityResult,
  type EligibilityRule,
  type EligibilityRuleType,
  type ExclusivityScope,
  type IsoDateTime,
  type PlayerProfile,
  type RankSnapshot,
  type RosterMembership,
  type RuleTarget,
  type SanctionPeriod,
} from './eligibility/eligibility.js';
export {
  ELIGIBILITY_RULES,
  type PlayerSubject,
  type RuleDefinition,
  type TeamSubject,
} from './eligibility/rules.js';
export {
  compareRanks,
  formatRank,
  rankValue,
  RANK_TIERS,
  type Rank,
  type RankDivision,
  type RankTier,
} from './eligibility/rank.js';
export {
  rule,
  Specification,
  specification,
  type FailureDetails,
  type SpecificationFailure,
} from './eligibility/specification.js';

// Lifecycles
export {
  createStateMachine,
  type StateMachine,
  type Transition,
  type TransitionTable,
} from './lifecycle/state-machine.js';
export {
  tournamentLifecycle,
  type TournamentContext,
  type TournamentEvent,
  type TournamentStatus,
} from './lifecycle/tournament.js';
export { matchLifecycle, type MatchContext, type MatchEvent } from './lifecycle/match.js';
export { gameLifecycle, type GameContext, type GameEvent } from './lifecycle/game.js';

// Teams
export {
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
  type CreateTeamState,
  type JoinCandidate,
  type TeamLimits,
  type TeamPermission,
  type TeamRole,
} from './teams/teams.js';
