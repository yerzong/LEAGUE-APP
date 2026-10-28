import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { ENV, type Env } from '../../../config/env.js';
import {
  DispatchDeliveriesUseCase,
  ProcessOutboxUseCase,
} from '../application/notifications.use-cases.js';

/**
 * Consumes the outbox and sends the queued deliveries on an interval. Work is
 * leased in the database (FOR UPDATE SKIP LOCKED), so several API instances
 * can run it at once without taking the same event or delivery.
 */
@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('NotificationWorker');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(ProcessOutboxUseCase) private readonly outbox: ProcessOutboxUseCase,
    @Inject(DispatchDeliveriesUseCase) private readonly dispatch: DispatchDeliveriesUseCase,
  ) {}

  onModuleInit(): void {
    if (this.env.NOTIFICATIONS_POLL_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.NOTIFICATIONS_POLL_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.outbox.execute();
      const deliveries = await this.dispatch.execute();
      if (events.processed + events.failed + deliveries.sent + deliveries.failed > 0)
        this.logger.log(
          `outbox: ${String(events.processed)} processed, ${String(events.failed)} failed; ` +
            `deliveries: ${String(deliveries.sent)} sent, ${String(deliveries.retried)} retried, ${String(deliveries.failed)} failed`,
        );
    } catch (error) {
      // Names only: no recipients, addresses or content.
      this.logger.error(
        error instanceof Error ? `${error.name}: ${error.message}` : 'notification tick failed',
      );
    } finally {
      this.running = false;
    }
  }
}
