import type { Clock } from '../../../shared/clock.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type { ImageStorage } from '../../../shared/storage/image-storage.js';
import type {
  CodeGenerator,
  FreeAgentRepository,
  RiotStatus,
  TeamRepository,
  UserDirectory,
} from './ports.js';

/** Everything the team use cases depend on (one provider in TeamsModule). */
export interface TeamsDeps {
  readonly teams: TeamRepository;
  readonly freeAgents: FreeAgentRepository;
  readonly users: UserDirectory;
  readonly riot: RiotStatus;
  readonly organization: CurrentOrganization;
  readonly storage: ImageStorage;
  readonly clock: Clock;
  readonly newCode: CodeGenerator;
  readonly newId: () => string;
}

export const TEAMS_DEPS = Symbol('TeamsDeps');
