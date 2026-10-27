import { Module, type Provider } from '@nestjs/common';

import { MATCHES_DEPS, type MatchesDeps } from '../matches/application/deps.js';
import { MatchesModule } from '../matches/matches.module.js';
import * as UseCases from './application/standings.use-cases.js';
import {
  AdminBoardController,
  PublicBoardController,
} from './presentation/standings.controller.js';

const useCaseProviders: Provider[] = Object.values(UseCases).map((UseCase) => ({
  provide: UseCase,
  inject: [MATCHES_DEPS],
  useFactory: (deps: MatchesDeps) => new UseCase(deps),
}));

/** Read side of the competition: boards and standings (written by the matches module). */
@Module({
  imports: [MatchesModule],
  controllers: [AdminBoardController, PublicBoardController],
  providers: useCaseProviders,
})
export class StandingsModule {}
