// Talks to the platform API's /bot endpoints with the shared secret. The API
// resolves the Discord identity, runs the use case and returns a ready reply;
// the bot never reimplements business rules (docs/specs/m07 §8).

import { type BotReply, BotReplySchema } from '@league/contracts';

export interface BotActor {
  readonly discordUserId: string;
  readonly discordUsername?: string;
}

const FALLBACK: BotReply = {
  content: 'No pude procesar el comando. Intenta de nuevo en un momento.',
  ephemeral: true,
};

export class BotApiClient {
  constructor(
    private readonly options: {
      readonly apiUrl: string;
      readonly apiSecret: string;
      readonly fetch?: typeof fetch;
    },
  ) {}

  private get fetchFn(): typeof fetch {
    return this.options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async post(path: string, body: Record<string, unknown>): Promise<BotReply> {
    try {
      const response = await this.fetchFn(`${this.options.apiUrl}/bot/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-bot-secret': this.options.apiSecret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return FALLBACK;
      return BotReplySchema.parse(await response.json());
    } catch {
      return FALLBACK;
    }
  }

  nextMatch(actor: BotActor): Promise<BotReply> {
    return this.post('next-match', { ...actor });
  }
  checkin(actor: BotActor): Promise<BotReply> {
    return this.post('checkin', { ...actor });
  }
  standings(actor: BotActor, tournament: string): Promise<BotReply> {
    return this.post('standings', { ...actor, tournament });
  }
  player(actor: BotActor, targetDiscordUserId?: string): Promise<BotReply> {
    return this.post('player', {
      ...actor,
      ...(targetDiscordUserId ? { targetDiscordUserId } : {}),
    });
  }
  team(actor: BotActor, name: string): Promise<BotReply> {
    return this.post('team', { ...actor, name });
  }
  link(actor: BotActor): Promise<BotReply> {
    return this.post('link', { ...actor });
  }
}
