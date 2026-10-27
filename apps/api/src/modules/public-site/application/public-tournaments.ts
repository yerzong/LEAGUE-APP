// Public tournament list and detail (docs/14 §5): published, non-private
// tournaments only; participants are the approved registrations.

import type {
  PublicTournamentDetail,
  PublicTournamentFilter,
  PublicTournamentList,
  PublicTournamentQuery,
  TournamentStatus,
} from '@league/contracts';

import { notFound } from '../../../shared/application-error.js';
import type { RegistrationQueries } from '../../registrations/application/registrations.use-cases.js';
import type { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';

export interface PublicTournamentsDeps {
  readonly tournaments: Pick<
    TournamentQueries,
    'list' | 'findBySlug' | 'listItem' | 'publicDetail'
  >;
  readonly registrations: Pick<RegistrationQueries, 'participants' | 'approvedCounts'>;
}

export const PUBLIC_TOURNAMENTS_DEPS = Symbol('PublicTournamentsDeps');

const STATUSES: Readonly<Record<PublicTournamentFilter, readonly TournamentStatus[]>> = {
  all: [
    'published',
    'registration_open',
    'registration_closed',
    'seeding',
    'in_progress',
    'completed',
    'canceled',
  ],
  open: ['registration_open'],
  upcoming: ['published'],
  live: ['registration_closed', 'seeding', 'in_progress'],
  finished: ['completed'],
};

export class ListPublicTournamentsUseCase {
  constructor(private readonly deps: PublicTournamentsDeps) {}

  async execute(query: PublicTournamentQuery): Promise<PublicTournamentList> {
    const { tournaments, total } = await this.deps.tournaments.list({
      statuses: STATUSES[query.status],
      publicOnly: true,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });
    const counts = await this.deps.registrations.approvedCounts(tournaments.map((t) => t.id));
    return {
      items: tournaments.map((t) => this.deps.tournaments.listItem(t, counts.get(t.id) ?? 0)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}

export class GetPublicTournamentUseCase {
  constructor(private readonly deps: PublicTournamentsDeps) {}

  /** Unlisted tournaments open by link; drafts and private ones do not exist publicly. */
  async execute(slug: string): Promise<PublicTournamentDetail> {
    const t = await this.deps.tournaments.findBySlug(slug);
    if (!t || t.status === 'draft' || t.config.basics.visibility === 'private')
      throw notFound('tournament_not_found');
    return this.deps.tournaments.publicDetail(t, await this.deps.registrations.participants(t.id));
  }
}
