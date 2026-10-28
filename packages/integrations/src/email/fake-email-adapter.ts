import type { EmailError, EmailMessage, EmailPort } from './ports.js';

/** Keeps the messages in memory instead of sending them (tests, CI, local). */
export class FakeEmailAdapter implements EmailPort {
  readonly sent: EmailMessage[] = [];
  private readonly failures: EmailError[] = [];

  /** The next sends fail with these errors, in order. */
  failNext(...errors: EmailError[]): void {
    this.failures.push(...errors);
  }

  send(message: EmailMessage): Promise<{ providerMessageId: string | null }> {
    const failure = this.failures.shift();
    if (failure) return Promise.reject(failure);
    // Idempotency like the real provider: the same key is delivered once.
    const repeated =
      message.idempotencyKey !== undefined &&
      this.sent.some((m) => m.idempotencyKey === message.idempotencyKey);
    if (!repeated) this.sent.push(message);
    return Promise.resolve({ providerMessageId: `fake-${String(this.sent.length)}` });
  }
}
