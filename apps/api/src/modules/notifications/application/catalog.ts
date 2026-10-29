// Which domain events notify, and as which notification types (docs/15 §3).
// The types themselves (category, critical, default channels, audience) live
// in notification_types; mapping a new event is adding a line here.

export interface EventMapping {
  readonly type: string;
  /** Only when the payload matches (for example a registration that went to the waitlist). */
  readonly when?: (payload: Readonly<Record<string, unknown>>) => boolean;
}

const waitlisted = (payload: Readonly<Record<string, unknown>>) =>
  payload['status'] === 'waitlisted';

/** In priority order: a user notified by one type is not notified again for the same event. */
export const EVENT_NOTIFICATIONS: Readonly<Record<string, readonly EventMapping[]>> = {
  'registration.submitted': [
    { type: 'registration.received', when: (p) => !waitlisted(p) },
    { type: 'registration.waitlisted', when: waitlisted },
    { type: 'staff.registration_submitted' },
  ],
  'registration.waitlisted': [{ type: 'registration.waitlisted' }],
  'registration.approved': [{ type: 'registration.approved' }],
  'registration.rejected': [{ type: 'registration.rejected' }],
  'registration.promoted': [{ type: 'registration.promoted' }],
  'registration.disqualified': [{ type: 'registration.disqualified' }],
  'tournament.published': [{ type: 'tournament.published' }],
  'tournament.rules_changed': [{ type: 'tournament.rules_changed' }],
  'tournament.scheduled': [{ type: 'tournament.schedule_published' }],
  'match.scheduled': [{ type: 'match.scheduled' }],
  'match.rescheduled': [{ type: 'match.rescheduled' }],
  'match.checkin_opened': [{ type: 'match.checkin_open' }],
  'match.forfeited': [{ type: 'match.forfeit' }],
  'match.completed': [{ type: 'match.result_confirmed' }],
  'dispute.opened': [{ type: 'dispute.opened' }, { type: 'staff.dispute_opened' }],
  'dispute.resolved': [{ type: 'dispute.resolved' }],
};

const COMMON = ['tournament.name', 'user.name'];
const MATCH = ['entrant.name', 'opponent.name', 'match.scheduled_at', 'winner.name'];

/** The variables each type's templates can use (the preview fills them with examples). */
export function variablesOf(typeKey: string, audience: string): string[] {
  const extra =
    audience === 'entrant'
      ? ['entrant.name', 'reason']
      : audience === 'match_parties'
        ? MATCH
        : audience === 'tournament_entrants'
          ? ['entrant.name']
          : typeKey === 'staff.dispute_opened'
            ? MATCH
            : typeKey === 'staff.registration_submitted'
              ? ['entrant.name']
              : [];
  return [...COMMON, ...extra].sort();
}

/** Where the notification takes the user (paths inside the platform). */
export function linkOf(
  typeKey: string,
  audience: string,
  ids: { tournamentId: string; tournamentSlug: string; matchId: string | null },
): string {
  if (typeKey === 'staff.registration_submitted')
    return `/admin/torneos/${ids.tournamentId}?tab=registrations`;
  if (typeKey === 'staff.dispute_opened' && ids.matchId)
    return `/admin/torneos/${ids.tournamentId}/partidas/${ids.matchId}`;
  if (typeKey === 'tournament.published') return `/torneos/${ids.tournamentSlug}`;
  if (typeKey === 'tournament.schedule_published') return '/app/partidas';
  if (audience === 'match_parties' && ids.matchId) return `/app/partidas/${ids.matchId}`;
  return `/app/torneos/${ids.tournamentSlug}`;
}
