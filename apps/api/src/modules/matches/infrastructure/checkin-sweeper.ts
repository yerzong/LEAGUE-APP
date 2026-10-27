import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { ENV, type Env } from '../../../config/env.js';
import { CheckinSweepUseCase } from '../application/matches.use-cases.js';

/**
 * Runs the check-in sweep on an interval: opens the windows that are due and
 * closes the expired ones (forfeits). The work itself is idempotent, so two
 * API instances sweeping at once only cost a version conflict.
 */
@Injectable()
export class CheckinSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CheckinSweeper');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(CheckinSweepUseCase) private readonly sweep: CheckinSweepUseCase,
  ) {}

  onModuleInit(): void {
    if (this.env.CHECKIN_SWEEP_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.CHECKIN_SWEEP_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { opened, closed } = await this.sweep.execute();
      if (opened + closed > 0)
        this.logger.log(`check-in: ${String(opened)} opened, ${String(closed)} closed`);
    } catch (error) {
      // Names only: no request data or PII.
      this.logger.error(
        error instanceof Error ? `${error.name}: ${error.message}` : 'sweep failed',
      );
    } finally {
      this.running = false;
    }
  }
}
