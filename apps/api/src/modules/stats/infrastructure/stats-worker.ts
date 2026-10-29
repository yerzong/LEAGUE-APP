import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { ENV, type Env } from '../../../config/env.js';
import { ProcessStatsJobsUseCase } from '../application/stats.use-cases.js';

/**
 * Drains the stats queue on an interval. Jobs are leased in the database
 * (FOR UPDATE SKIP LOCKED), so several API instances can run it at once.
 */
@Injectable()
export class StatsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('StatsWorker');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(ProcessStatsJobsUseCase) private readonly jobs: ProcessStatsJobsUseCase,
  ) {}

  onModuleInit(): void {
    if (this.env.STATS_POLL_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.STATS_POLL_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { processed, failed } = await this.jobs.execute();
      if (processed + failed > 0)
        this.logger.log(`stats: ${String(processed)} matches, ${String(failed)} failed`);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? `${error.name}: ${error.message}` : 'stats tick failed',
      );
    } finally {
      this.running = false;
    }
  }
}
