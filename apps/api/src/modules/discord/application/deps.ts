import type { DiscordPort, EmbedTheme } from '@league/integrations';

import type { Clock } from '../../../shared/clock.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type { GetPublicBoardUseCase } from '../../standings/application/standings.use-cases.js';
import type {
  CheckInUseCase,
  ListMyMatchesUseCase,
} from '../../matches/application/matches.use-cases.js';
import type {
  GetPublicPlayerUseCase,
  GetPublicTeamUseCase,
} from '../../public-site/application/public-pages.js';
import type { ProfileQueries } from '../../identity/application/profile.use-cases.js';
import type { TournamentQueries } from '../../tournaments/application/tournaments.use-cases.js';
import type { DiscordDirectory } from './ports.js';

/** Everything the Discord use cases depend on (one provider in DiscordModule). */
export interface DiscordDeps {
  readonly directory: DiscordDirectory;
  readonly discord: DiscordPort;
  /** True when a real bot token is configured (so sending actually works). */
  readonly botReady: boolean;
  readonly theme: EmbedTheme;
  readonly organization: CurrentOrganization;
  readonly clock: Clock;
  readonly profiles: Pick<ProfileQueries, 'findById'>;
  readonly tournaments: Pick<TournamentQueries, 'findBySlug'>;
  readonly queries: {
    readonly myMatches: ListMyMatchesUseCase;
    readonly checkIn: CheckInUseCase;
    readonly board: GetPublicBoardUseCase;
    readonly player: GetPublicPlayerUseCase;
    readonly team: GetPublicTeamUseCase;
  };
}

export const DISCORD_DEPS = Symbol('DiscordDeps');
