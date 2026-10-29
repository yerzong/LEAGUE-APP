import { EmailError, type EmailMessage, type EmailPort } from './ports.js';

export interface ResendEmailAdapterOptions {
  /** Server-side only. Sent as a bearer token, never in URLs or logs. */
  readonly apiKey: string;
  /** `Name <address>` of a domain verified in Resend. */
  readonly from: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

const ENDPOINT = 'https://api.resend.com/emails';

/** EmailPort over the Resend HTTP API. */
export class ResendEmailAdapter implements EmailPort {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ResendEmailAdapterOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async send(message: EmailMessage): Promise<{ providerMessageId: string | null }> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.options.apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    };
    if (message.idempotencyKey) headers['idempotency-key'] = message.idempotencyKey;
    let response: Response;
    try {
      response = await this.fetchFn(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new EmailError('unavailable', null);
    }
    if (response.status === 429) throw new EmailError('rate_limited', 429);
    if (response.status === 401 || response.status === 403)
      throw new EmailError('unauthorized', response.status);
    if (response.status === 400 || response.status === 422)
      throw new EmailError('rejected', response.status);
    if (!response.ok) throw new EmailError('unavailable', response.status);
    const body: unknown = await response.json().catch(() => null);
    const id =
      typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string'
        ? body.id
        : null;
    return { providerMessageId: id };
  }
}
