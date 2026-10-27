import { Module, type Provider } from '@nestjs/common';

import { MATCHES_DEPS, type MatchesDeps } from '../matches/application/deps.js';
import { MatchesModule } from '../matches/matches.module.js';
import * as UseCases from './application/scheduling.use-cases.js';
import { SchedulingController } from './presentation/scheduling.controller.js';

const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [MATCHES_DEPS],
  useFactory: (deps: MatchesDeps) => new UseCase(deps),
}));

/** Calendar and reschedules, written through the matches unit of work. */
@Module({
  imports: [MatchesModule],
  controllers: [SchedulingController],
  providers: useCaseProviders,
})
export class SchedulingModule {}
