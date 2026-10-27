import { DomainError } from '@league/core';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { ApplicationError, type ErrorKind } from './application-error.js';

const STATUS: Readonly<Record<ErrorKind, number>> = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
};

/** Every error leaves the API as `{ code, details? }` (ApiErrorSchema). */
@Catch()
export class ApplicationErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApplicationErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApplicationError) {
      response
        .status(STATUS[exception.kind])
        .json({ code: exception.code, details: exception.details });
      return;
    }
    // Rules of packages/core (team, lifecycle, edit policy, roster…): a guard or
    // team rule names its `reason`, the others their own code.
    if (exception instanceof DomainError) {
      const { reason, ...details } = exception.details;
      response
        .status(409)
        .json({ code: typeof reason === 'string' ? reason : exception.code, details });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        status === 401
          ? 'unauthorized'
          : status === 404
            ? 'not_found'
            : status === 413
              ? 'file_too_large'
              : 'http_error';
      response.status(status).json({ code });
      return;
    }
    // Unexpected: log the name and message only (no request data, no PII).
    const error = exception instanceof Error ? exception : new Error('non-error thrown');
    this.logger.error(`${error.name}: ${error.message}`, error.stack);
    response.status(500).json({ code: 'internal_error' });
  }
}
