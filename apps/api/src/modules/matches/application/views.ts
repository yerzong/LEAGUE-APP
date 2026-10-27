// What the API returns about matches: summaries (boards, lists) and the
// detail with what the viewer may do on it.
import type { MatchDetail, MatchEntrant, MatchPermissions, MatchSummary } from '@league/contracts';

import type { EntrantView } from '../../registrations/application/registrations.use-cases.js';
import type { MatchRecord, PhaseInfo } from '../domain/match.js';
import type { MatchesDeps } from './deps.js';

export const toEntrant = (e: EntrantView | undefined): MatchEntrant | null =>
  e
    ? {
        id: e.id,
        displayName: e.displayName,
        displayTag: e.displayTag,
        logoUrl: e.logoUrl,
        teamSlug: e.teamSlug,
        seed: e.seed,
      }
    : null;

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toSummary(
  record: MatchRecord,
  phase: Pick<PhaseInfo, 'name' | 'groups'> | undefined,
  entrants: ReadonlyMap<string, EntrantView>,
  keys: ReadonlyMap<string, string>,
): MatchSummary {
  const source = (s: MatchRecord['sourceA']) =>
    s?.kind === 'match'
      ? { bracketKey: keys.get(s.matchId) ?? s.matchId, outcome: s.outcome }
      : null;
  return {
    id: record.id,
    tournamentId: record.tournamentId,
    phaseId: record.phaseId,
    phaseName: phase?.name ?? '',
    groupName: phase?.groups.find((g) => g.id === record.groupId)?.name ?? null,
    bracketKey: record.bracketKey,
    round: record.round,
    position: record.position,
    bracketSide: record.bracketSide,
    seriesFormat: record.seriesFormat,
    draftMode: record.draftMode,
    status: record.status,
    scheduledAt: iso(record.scheduledAt),
    checkinOpensAt: iso(record.checkinOpensAt),
    checkinClosesAt: iso(record.checkinClosesAt),
    entrantA: record.entrantA ? toEntrant(entrants.get(record.entrantA)) : null,
    entrantB: record.entrantB ? toEntrant(entrants.get(record.entrantB)) : null,
    sourceA: source(record.sourceA),
    sourceB: source(record.sourceB),
    scoreA: record.scoreA,
    scoreB: record.scoreB,
    winnerId: record.winnerId,
    resultSource: record.resultSource,
    finalizedAt: iso(record.finalizedAt),
    version: record.version,
  };
}

/** Core match ids are bracket keys already; `keys` maps them for display. */
export const bracketKeys = (records: readonly MatchRecord[]) =>
  new Map(records.map((r) => [r.bracketKey, r.bracketKey]));

const REPORTABLE = new Set(['ready', 'live', 'awaiting_result']);
const OPEN = new Set(['pending', 'accepted']);

export async function buildDetail(
  deps: MatchesDeps,
  record: MatchRecord,
  viewerId: string | null,
): Promise<MatchDetail> {
  const tournament = await deps.tournaments.findById(record.tournamentId);
  if (!tournament) throw new Error('match without tournament');
  const [phases, entrants, games, checkins, disputes, reschedules, staff, managed] =
    await Promise.all([
      deps.tournaments.phases(record.tournamentId),
      deps.entrants.entrantsOf(record.tournamentId),
      deps.matches.games([record.id]),
      deps.matches.checkins([record.id]),
      deps.matches.disputes([record.id]),
      deps.matches.reschedules([record.id]),
      viewerId ? deps.tournaments.isStaff(viewerId) : Promise.resolve(false),
      viewerId
        ? deps.entrants.managedBy(viewerId, record.tournamentId)
        : Promise.resolve(new Set<string>()),
    ]);
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const phase = phases.find((p) => p.id === record.phaseId);
  const mine = [record.entrantA, record.entrantB].find((e) => e !== null && managed.has(e)) ?? null;
  const party = staff || mine !== null;
  const reports = party ? await deps.matches.reports(record.id) : [];
  const paths = [
    ...reports.flatMap((r) => r.evidencePaths),
    ...disputes.flatMap((d) => d.evidence.flatMap((e) => (e.storagePath ? [e.storagePath] : []))),
  ];
  const urls = paths.length > 0 ? await deps.evidence.signedUrls(paths) : new Map<string, string>();
  const checkedIn = checkins.map((c) => c.entrantId);
  const now = deps.clock.now();
  const openDispute = disputes.some((d) => d.status === 'open' || d.status === 'under_review');
  const openReschedule = reschedules.find((r) => OPEN.has(r.status));

  const permissions: MatchPermissions | null = party
    ? {
        entrantId: mine,
        isStaff: staff,
        canCheckIn: mine !== null && record.status === 'checkin' && !checkedIn.includes(mine),
        canReport: mine !== null && REPORTABLE.has(record.status),
        canDispute:
          mine !== null &&
          !openDispute &&
          (record.status === 'awaiting_result' ||
            (record.status === 'completed' &&
              record.disputeDeadline !== null &&
              record.disputeDeadline > now)),
        canRequestReschedule:
          mine !== null && ['pending', 'scheduled'].includes(record.status) && !openReschedule,
        canRespondReschedule:
          mine !== null &&
          openReschedule?.status === 'pending' &&
          openReschedule.requestedByEntrantId !== mine,
      }
    : null;

  return {
    ...toSummary(record, phase, byId, new Map()),
    tournament: {
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.config.basics.name,
      timezone: tournament.config.basics.timezone,
      status: tournament.status,
    },
    games: games
      .sort((a, b) => a.number - b.number)
      .map((g) => ({ number: g.number, winnerId: g.winnerId })),
    checkedIn,
    disputeDeadline: iso(record.disputeDeadline),
    reports: reports.map((r) => ({
      entrantId: r.entrantId,
      winnerId: r.winnerId,
      scoreA: r.scoreA,
      scoreB: r.scoreB,
      games: [...r.games],
      evidenceUrls: r.evidencePaths.flatMap((p) => (urls.get(p) ? [urls.get(p) as string] : [])),
      submittedAt: r.submittedAt.toISOString(),
    })),
    disputes: party
      ? disputes.map((d) => ({
          id: d.id,
          category: d.category,
          description: d.description,
          status: d.status,
          openedByEntrantId: d.openedByEntrantId,
          resolution: d.resolution,
          resolvedAt: iso(d.resolvedAt),
          createdAt: d.createdAt.toISOString(),
          evidence: d.evidence.map((e) => ({
            id: e.id,
            url: e.url ?? (e.storagePath ? (urls.get(e.storagePath) ?? null) : null),
            note: e.note,
            createdAt: e.createdAt.toISOString(),
          })),
        }))
      : [],
    reschedules: party
      ? reschedules.map((r) => ({
          id: r.id,
          requestedByEntrantId: r.requestedByEntrantId,
          proposedAt: r.proposedAt.map((d) => d.toISOString()),
          chosenAt: iso(r.chosenAt),
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }))
      : [],
    permissions,
  };
}
