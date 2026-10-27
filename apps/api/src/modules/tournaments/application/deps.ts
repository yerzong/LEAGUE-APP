import type { PhaseFormatRegistry } from '@league/core';

import type { Clock } from '../../../shared/clock.js';
import type { CurrentOrganization } from '../../../shared/organization.js';
import type { ImageStorage } from '../../../shared/storage/image-storage.js';
import type { StaffDirectory, TemplateRepository, TournamentRepository } from './ports.js';

/** Everything the tournament use cases depend on (one provider in TournamentsModule). */
export interface TournamentsDeps {
  readonly tournaments: TournamentRepository;
  readonly templates: TemplateRepository;
  readonly staff: StaffDirectory;
  readonly organization: CurrentOrganization;
  readonly storage: ImageStorage;
  readonly clock: Clock;
  readonly formats: PhaseFormatRegistry;
  readonly newId: () => string;
}

export const TOURNAMENTS_DEPS = Symbol('TournamentsDeps');
