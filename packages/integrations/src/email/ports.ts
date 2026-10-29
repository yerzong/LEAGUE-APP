// EmailPort (docs/04-arquitectura.md §5, docs/15 §2): what the notification
// engine needs to send an email. Adapters: Resend (HTTP API) and a fake that
// keeps the messages in memory (tests, CI, local without a key).

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** Same key, same email: a retried send is not delivered twice. */
  readonly idempotencyKey?: string | undefined;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<{ providerMessageId: string | null }>;
}

export type EmailErrorKind = 'rate_limited' | 'unauthorized' | 'rejected' | 'unavailable';

/** A failure sending an email. Never carries the API key or the recipient. */
export class EmailError extends Error {
  constructor(
    readonly kind: EmailErrorKind,
    readonly status: number | null,
  ) {
    super(`Email provider error: ${kind}${status === null ? '' : ` (${String(status)})`}`);
    this.name = 'EmailError';
  }

  /** Rejected messages (invalid address, content) fail the same way when retried. */
  get retryable(): boolean {
    return this.kind !== 'rejected';
  }
}
