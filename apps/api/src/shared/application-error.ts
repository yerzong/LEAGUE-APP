/** How an application error maps to HTTP (see ApplicationErrorFilter). */
export type ErrorKind =
  'invalid' | 'not_found' | 'forbidden' | 'conflict' | 'unavailable' | 'rate_limited';

/**
 * Expected failure of a use case. `code` is stable and documented in
 * packages/i18n (`errors.*`); `details` never carries PII or secrets.
 */
export class ApplicationError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly code: string,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${kind}: ${code}`);
    this.name = 'ApplicationError';
  }
}

export const notFound = (code = 'not_found') => new ApplicationError('not_found', code);
export const forbidden = (code = 'forbidden') => new ApplicationError('forbidden', code);
export const conflict = (code: string, details: Record<string, unknown> = {}) =>
  new ApplicationError('conflict', code, details);
