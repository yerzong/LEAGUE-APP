// Reconciles Discord voice channels with match status on an interval (like the
// check-in sweeper): opens channels when a match enters check-in, deletes them
// when it ends. Off unless a bot token is configured and DISCORD_POLL_SECONDS>0.

import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { ENV, type Env } from '../../../config/env.js';
import { ReconcileMatchVoiceUseCase } from '../application/discord.use-cases.js';

@Injectable()
export class DiscordWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('DiscordWorker');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(ReconcileMatchVoiceUseCase) private readonly reconcile: ReconcileMatchVoiceUseCase,
  ) {}

  onModuleInit(): void {
    if (this.env.DISCORD_PROVIDER !== 'bot' || this.env.DISCORD_POLL_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.env.DISCORD_POLL_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { opened, closed } = await this.reconcile.execute();
      if (opened + closed > 0)
        this.logger.log(`voice channels: ${String(opened)} opened, ${String(closed)} closed`);
    } catch (error) {
      this.logger.error(
        error instanceof Error ? `${error.name}: ${error.message}` : 'discord tick failed',
      );
    } finally {
      this.running = false;
    }
  }
}
